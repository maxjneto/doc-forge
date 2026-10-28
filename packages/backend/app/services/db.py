import datetime
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AuditFinding,
    Document,
    Feedback,
    SectionVersion,
    Suggestion,
)
from app.models.document_activity import DocumentActivity
from app.models.user import User
from app.schemas.sse import SSEEvent
from app.services import sse as sse_service


async def log_activity(
    db: AsyncSession,
    document_id: uuid.UUID,
    action_type: str,
    description: str | None = None,
    api_key_id: uuid.UUID | None = None,
    bytes_delta: int | None = None,
    version_id: uuid.UUID | None = None,
) -> None:
    entry = DocumentActivity(
        id=uuid.uuid4(),
        document_id=document_id,
        api_key_id=api_key_id,
        action_type=action_type,
        description=description,
        bytes_delta=bytes_delta,
        version_id=version_id,
    )
    db.add(entry)
    await db.flush()


async def _prune_old_versions(db: AsyncSession, section_id: uuid.UUID, doc_id: uuid.UUID) -> None:
    """Free-plan version retention (product-plan §9.4): keep at most N total
    versions per section (the active one plus the N-1 most recent inactive
    ones), oldest pruned first.

    Never touches the active version, and skips any version still referenced
    by a Suggestion (proposed or base) — pruning must never silently break a
    pending review. Severs `parent_version_id` links on children of a pruned
    version first since that FK has no ON DELETE clause.
    """
    from app.services import tiers as tiers_service

    doc_result = await db.execute(select(Document.user_id).where(Document.id == doc_id))
    user_id = doc_result.scalar_one_or_none()
    if user_id is None:
        return
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return
    limit = tiers_service.get_limits(user.plan).get("max_versions_per_section")
    if limit is None or limit < 1:
        return
    max_inactive = max(limit - 1, 0)  # one slot is always the active version

    referenced_result = await db.execute(
        select(Suggestion.proposed_version_id).where(Suggestion.section_id == section_id)
        .union(select(Suggestion.base_version_id).where(Suggestion.section_id == section_id))
    )
    referenced_ids = {row[0] for row in referenced_result.all() if row[0] is not None}

    inactive_result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active.is_(False))
        .order_by(SectionVersion.created_at.desc())
    )
    inactive = [
        v
        for v in inactive_result.scalars().all()
        if v.id not in referenced_ids and not v.is_published
    ]
    if len(inactive) <= max_inactive:
        return

    for stale in inactive[max_inactive:]:
        await db.execute(
            update(SectionVersion)
            .where(SectionVersion.parent_version_id == stale.id)
            .values(parent_version_id=None)
        )
        await db.delete(stale)
    await db.commit()


async def create_section_version(
    db: AsyncSession,
    section_id: uuid.UUID,
    version_name: str,
    content: str,
    parent_version_id: uuid.UUID | None = None,
    doc_id: uuid.UUID | None = None,
) -> SectionVersion:
    """INTERNAL: caller must validate section ownership before invoking."""
    # Deactivate current active version
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active.is_(True))
        .values(is_active=False)
    )
    # Create new active version
    version = SectionVersion(
        section_id=section_id,
        parent_version_id=parent_version_id,
        version_name=version_name,
        content=content,
        is_active=True,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    if doc_id is not None:
        sse_service.publish(str(doc_id), SSEEvent(
            type="section_updated",
            payload={"doc_id": str(doc_id), "section_id": str(section_id)},
        ))
        await _prune_old_versions(db, section_id, doc_id)
    return version

async def update_section_content(
    db: AsyncSession,
    section_id: uuid.UUID,
    new_content: str,
    doc_id: uuid.UUID | None = None,
    api_key_id: uuid.UUID | None = None,
    note: str | None = None,
) -> SectionVersion:
    """INTERNAL: caller must validate section ownership before invoking."""
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active == True)  # noqa: E712
    )
    active = result.scalar_one_or_none()
    if not active:
        raise ValueError("No active version found for section")

    old_len = len(active.content or "")

    # A published version is an immutable release. The first write after a
    # publication forks a fresh working draft so public links keep serving the
    # signed-off content until the user explicitly publishes again. Subsequent
    # autosaves can update that draft in place without creating a version per
    # keystroke.
    if active.is_published:
        active = await create_section_version(
            db,
            section_id,
            f"Draft after {active.version_name}",
            new_content,
            parent_version_id=active.id,
            doc_id=doc_id,
        )
    else:
        active.content = new_content
    new_len = len(new_content)
    bytes_delta = new_len - old_len

    if doc_id is not None:
        actor = "Agent" if api_key_id else "You"
        description = note or f"{actor} wrote {new_len:,} characters ({bytes_delta:+,})"
        await log_activity(
            db, doc_id, "write",
            description=description,
            api_key_id=api_key_id,
            bytes_delta=bytes_delta,
        )

    await db.commit()
    await db.refresh(active)
    if doc_id is not None:
        sse_service.publish(str(doc_id), SSEEvent(
            type="section_updated",
            payload={"doc_id": str(doc_id), "section_id": str(section_id)},
        ))
    return active

async def create_version_snapshot(
    db: AsyncSession,
    section_id: uuid.UUID,
    doc_id: uuid.UUID,
    version_name: str | None = None,
    change_summary: str | None = None,
    api_key_id: uuid.UUID | None = None,
) -> SectionVersion:
    """Create a snapshot of the current active version with no AI involvement.

    INTERNAL: caller must validate section ownership before invoking.
    """
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active.is_(True))
    )
    active = result.scalar_one_or_none()
    if not active:
        raise ValueError("No active version found for section")

    import datetime
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M")
    snap_name = version_name or f"Snapshot {timestamp}"

    new_version = await create_section_version(
        db,
        section_id,
        snap_name,
        active.content,
        parent_version_id=active.id,
        doc_id=doc_id,
    )
    if change_summary:
        new_version.change_summary = change_summary
        await db.commit()
        await db.refresh(new_version)

    actor = "Agent" if api_key_id else "You"
    await log_activity(
        db, doc_id, "snapshot",
        description=f"{actor} saved snapshot '{snap_name}'" + (f": {change_summary}" if change_summary else ""),
        api_key_id=api_key_id,
        version_id=new_version.id,
    )
    await db.commit()
    return new_version


async def restore_version(
    db: AsyncSession,
    section_id: uuid.UUID,
    version_id: uuid.UUID,
    doc_id: uuid.UUID | None = None,
    api_key_id: uuid.UUID | None = None,
) -> SectionVersion:
    """INTERNAL: caller must validate section ownership before invoking."""
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active.is_(True))
        .values(is_active=False)
    )
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.id == version_id)
        .values(is_active=True)
    )
    result = await db.execute(select(SectionVersion).where(SectionVersion.id == version_id))
    restored = result.scalar_one()

    if doc_id is not None:
        actor = "Agent" if api_key_id else "You"
        await log_activity(
            db, doc_id, "version_selected",
            description=f"{actor} selected version '{restored.version_name}'",
            api_key_id=api_key_id,
            version_id=version_id,
        )
        sse_service.publish(str(doc_id), SSEEvent(
            type="section_updated",
            payload={"doc_id": str(doc_id), "section_id": str(section_id)},
        ))

    await db.commit()
    return restored


# ─── Suggestions (P1 — the "PR model" for documents) ─────────

async def create_suggestion(
    db: AsyncSession,
    section_id: uuid.UUID,
    doc_id: uuid.UUID,
    content: str,
    note: str | None = None,
    api_key_id: uuid.UUID | None = None,
) -> Suggestion:
    """Create a pending suggestion: a non-active SectionVersion + review row.

    INTERNAL: caller must validate section ownership before invoking.
    """
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active.is_(True))
    )
    active = result.scalar_one_or_none()

    actor = "Agent"
    if api_key_id is not None:
        from app.models.api_key import ApiKey
        key_result = await db.execute(select(ApiKey.name).where(ApiKey.id == api_key_id))
        actor = key_result.scalar_one_or_none() or "Agent"

    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M")
    proposed = SectionVersion(
        section_id=section_id,
        parent_version_id=active.id if active else None,
        version_name=f"Suggestion by {actor} — {timestamp}",
        content=content,
        is_active=False,
        change_summary=note[:500] if note else None,
    )
    db.add(proposed)
    await db.flush()

    suggestion = Suggestion(
        document_id=doc_id,
        section_id=section_id,
        proposed_version_id=proposed.id,
        base_version_id=active.id if active else None,
        api_key_id=api_key_id,
        status="pending",
        note=note,
    )
    db.add(suggestion)
    await db.flush()

    await log_activity(
        db, doc_id, "suggestion_created",
        description=f"{actor} proposed a change ({len(content):,} chars) awaiting review",
        api_key_id=api_key_id,
        version_id=proposed.id,
    )
    await db.commit()
    await db.refresh(suggestion)
    sse_service.publish(str(doc_id), SSEEvent(
        type="suggestion_created",
        payload={
            "doc_id": str(doc_id),
            "section_id": str(section_id),
            "suggestion_id": str(suggestion.id),
        },
    ))
    return suggestion


async def get_suggestion(db: AsyncSession, suggestion_id: uuid.UUID) -> Suggestion | None:
    result = await db.execute(
        select(Suggestion)
        .options(
            selectinload(Suggestion.proposed_version),
            selectinload(Suggestion.api_key),
        )
        .where(Suggestion.id == suggestion_id)
    )
    return result.scalar_one_or_none()


async def list_suggestions(
    db: AsyncSession,
    doc_id: uuid.UUID,
    status: str | None = None,
) -> list[Suggestion]:
    query = (
        select(Suggestion)
        .options(
            selectinload(Suggestion.proposed_version),
            selectinload(Suggestion.api_key),
        )
        .where(Suggestion.document_id == doc_id)
        .order_by(Suggestion.created_at.desc())
    )
    if status:
        query = query.where(Suggestion.status == status)
    result = await db.execute(query)
    return list(result.scalars().all())


async def accept_suggestion(
    db: AsyncSession,
    suggestion: Suggestion,
) -> Suggestion:
    """Accept a pending suggestion: its proposed version becomes active.

    INTERNAL: caller must validate ownership and pending status before invoking.
    """
    await db.execute(
        update(SectionVersion)
        .where(
            SectionVersion.section_id == suggestion.section_id,
            SectionVersion.is_active.is_(True),
        )
        .values(is_active=False)
    )
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.id == suggestion.proposed_version_id)
        .values(is_active=True)
    )
    suggestion.status = "accepted"
    suggestion.resolved_at = datetime.datetime.now(datetime.UTC)

    await log_activity(
        db, suggestion.document_id, "suggestion_accepted",
        description="You accepted a suggested change",
        version_id=suggestion.proposed_version_id,
    )
    await db.commit()
    await db.refresh(suggestion)
    for event_type in ("suggestion_resolved", "section_updated"):
        sse_service.publish(str(suggestion.document_id), SSEEvent(
            type=event_type,
            payload={
                "doc_id": str(suggestion.document_id),
                "section_id": str(suggestion.section_id),
                "suggestion_id": str(suggestion.id),
                "status": "accepted",
            },
        ))
    return suggestion


async def reject_suggestion(
    db: AsyncSession,
    suggestion: Suggestion,
    comment: str | None = None,
    author_user_id: str | None = None,
) -> Suggestion:
    """Reject a pending suggestion. A comment automatically becomes agent-readable feedback.

    INTERNAL: caller must validate ownership and pending status before invoking.
    """
    suggestion.status = "rejected"
    suggestion.review_comment = comment
    suggestion.resolved_at = datetime.datetime.now(datetime.UTC)

    if comment:
        feedback = Feedback(
            document_id=suggestion.document_id,
            section_id=suggestion.section_id,
            suggestion_id=suggestion.id,
            author_user_id=author_user_id,
            content=comment,
            status="open",
        )
        db.add(feedback)

    await log_activity(
        db, suggestion.document_id, "suggestion_rejected",
        description="You rejected a suggested change"
        + (f": {comment[:200]}" if comment else ""),
        version_id=suggestion.proposed_version_id,
    )
    await db.commit()
    await db.refresh(suggestion)
    sse_service.publish(str(suggestion.document_id), SSEEvent(
        type="suggestion_resolved",
        payload={
            "doc_id": str(suggestion.document_id),
            "section_id": str(suggestion.section_id),
            "suggestion_id": str(suggestion.id),
            "status": "rejected",
        },
    ))
    if comment:
        sse_service.publish(str(suggestion.document_id), SSEEvent(
            type="feedback_created",
            payload={"doc_id": str(suggestion.document_id), "suggestion_id": str(suggestion.id)},
        ))
    return suggestion


# ─── Feedback (P2 — human→agent loop) ────────────────────────

async def create_feedback(
    db: AsyncSession,
    doc_id: uuid.UUID,
    content: str,
    section_id: uuid.UUID | None = None,
    author_user_id: str | None = None,
    suggestion_id: uuid.UUID | None = None,
) -> Feedback:
    """INTERNAL: caller must validate document ownership before invoking."""
    feedback = Feedback(
        document_id=doc_id,
        section_id=section_id,
        suggestion_id=suggestion_id,
        author_user_id=author_user_id,
        content=content,
        status="open",
    )
    db.add(feedback)
    await db.flush()
    await log_activity(
        db, doc_id, "feedback_created",
        description=f"You left feedback: {content[:200]}",
    )
    await db.commit()
    await db.refresh(feedback)
    sse_service.publish(str(doc_id), SSEEvent(
        type="feedback_created",
        payload={"doc_id": str(doc_id), "feedback_id": str(feedback.id)},
    ))
    return feedback


async def get_feedback(db: AsyncSession, feedback_id: uuid.UUID) -> Feedback | None:
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    return result.scalar_one_or_none()


async def list_feedback(
    db: AsyncSession,
    doc_id: uuid.UUID,
    status: str | None = None,
) -> list[Feedback]:
    query = (
        select(Feedback)
        .where(Feedback.document_id == doc_id)
        .order_by(Feedback.created_at)
    )
    if status:
        query = query.where(Feedback.status == status)
    result = await db.execute(query)
    return list(result.scalars().all())


async def resolve_feedback(
    db: AsyncSession,
    feedback: Feedback,
    status: str = "resolved",
    resolution_note: str | None = None,
    api_key_id: uuid.UUID | None = None,
) -> Feedback:
    """INTERNAL: caller must validate document ownership before invoking."""
    feedback.status = status
    feedback.resolution_note = resolution_note
    feedback.resolved_at = datetime.datetime.now(datetime.UTC)

    actor = "Agent" if api_key_id else "You"
    await log_activity(
        db, feedback.document_id, "feedback_resolved",
        description=f"{actor} marked feedback as {status}"
        + (f": {resolution_note[:200]}" if resolution_note else ""),
        api_key_id=api_key_id,
    )
    await db.commit()
    await db.refresh(feedback)
    sse_service.publish(str(feedback.document_id), SSEEvent(
        type="feedback_resolved",
        payload={
            "doc_id": str(feedback.document_id),
            "feedback_id": str(feedback.id),
            "status": status,
        },
    ))
    return feedback


async def get_audit_findings(
    db: AsyncSession,
    doc_id: uuid.UUID,
) -> list[AuditFinding]:
    result = await db.execute(
        select(AuditFinding)
        .where(AuditFinding.document_id == doc_id, AuditFinding.dismissed.is_(False))
        .order_by(AuditFinding.created_at)
    )
    return list(result.scalars().all())


async def dismiss_audit_finding(db: AsyncSession, finding_id: uuid.UUID) -> None:
    await db.execute(
        update(AuditFinding)
        .where(AuditFinding.id == finding_id)
        .values(dismissed=True)
    )
    await db.commit()
