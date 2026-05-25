import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AuditFinding,
    ChatMessage,
    DiscoveryQuestion,
    Document,
    DocumentContract,
    PromptTemplate,
    Section,
    SectionVersion,
)
from app.models.document_activity import DocumentActivity
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


async def set_phase(db: AsyncSession, doc_id: uuid.UUID, phase: str) -> None:
    """INTERNAL: caller must validate document ownership before invoking."""
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(current_phase=phase, updated_at=func.now())
    )
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="phase_changed",
        payload={"doc_id": str(doc_id), "phase": phase},
    ))


async def set_error_phase(
    db: AsyncSession,
    doc_id: uuid.UUID,
    error_message: str | None,
) -> None:
    """INTERNAL: caller must validate document ownership before invoking."""
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(current_phase="error", error_message=error_message, updated_at=func.now())
    )
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="error",
        payload={"doc_id": str(doc_id), "message": error_message},
    ))


async def save_global_context(db: AsyncSession, doc_id: uuid.UUID, context: str) -> None:
    """INTERNAL: caller must validate document ownership before invoking."""
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(global_context=context, updated_at=func.now())
    )
    await db.commit()


async def save_user_preferences(db: AsyncSession, doc_id: uuid.UUID, preferences: str) -> None:
    """INTERNAL: caller must validate document ownership before invoking."""
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(user_preferences=preferences, updated_at=func.now())
    )
    await db.commit()


async def save_summaries(db: AsyncSession, doc_id: uuid.UUID, summaries: dict[str, str]) -> None:
    """Save section summaries. summaries = {section_type: summary_text}"""
    for section_type, summary in summaries.items():
        # Ensure section exists
        result = await db.execute(
            select(Section).where(
                Section.document_id == doc_id,
                Section.section_type == section_type,
            )
        )
        section = result.scalar_one_or_none()
        if section:
            section.summary = summary
        else:
            section = Section(
                document_id=doc_id,
                section_type=section_type,
                summary=summary,
            )
            db.add(section)
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="section_updated",
        payload={"doc_id": str(doc_id), "change": "summaries"},
    ))


async def save_discovery_question(
    db: AsyncSession,
    doc_id: uuid.UUID,
    question: str,
    section_key: str | None = None,
) -> DiscoveryQuestion:
    q = DiscoveryQuestion(document_id=doc_id, question=question, section_key=section_key)
    db.add(q)
    await db.commit()
    await db.refresh(q)
    sse_service.publish(str(doc_id), SSEEvent(
        type="document_updated",
        payload={"doc_id": str(doc_id), "change": "discovery_question"},
    ))
    return q


async def save_section_context(db: AsyncSession, section_id: uuid.UUID, context: str) -> None:
    """Store the AI-synthesized discovery context for a specific section."""
    await db.execute(
        update(Section)
        .where(Section.id == section_id)
        .values(discovery_context=context)
    )
    await db.commit()


async def finalize_section(
    db: AsyncSession,
    section_id: uuid.UUID,
    doc_id: uuid.UUID | None = None,
) -> None:
    """INTERNAL: caller must validate section ownership before invoking."""
    await db.execute(
        update(Section)
        .where(Section.id == section_id)
        .values(status="finalized", updated_at=func.now())
    )
    await db.commit()
    if doc_id is not None:
        sse_service.publish(str(doc_id), SSEEvent(
            type="section_updated",
            payload={"doc_id": str(doc_id), "section_id": str(section_id), "status": "finalized"},
        ))


async def start_refinement(db: AsyncSession, doc_id: uuid.UUID) -> None:
    """Transition all drafting sections to refining status when Phase 4 starts.

    INTERNAL: caller must validate document ownership before invoking.
    """
    await db.execute(
        update(Section)
        .where(Section.document_id == doc_id, Section.status == "drafting")
        .values(status="refining", updated_at=func.now())
    )
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="section_updated",
        payload={"doc_id": str(doc_id), "change": "start_refinement"},
    ))


async def all_sections_finalized(db: AsyncSession, doc_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Section).where(
            Section.document_id == doc_id,
            Section.status != "finalized",
        )
    )
    return result.first() is None


async def reopen_sections(db: AsyncSession, doc_id: uuid.UUID, section_types: list[str]) -> None:
    """INTERNAL: caller must validate document ownership before invoking."""
    await db.execute(
        update(Section)
        .where(Section.document_id == doc_id, Section.section_type.in_(section_types))
        .values(status="refining", updated_at=func.now())
    )
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="section_updated",
        payload={"doc_id": str(doc_id), "section_types": section_types},
    ))


async def save_audit_problems(db: AsyncSession, doc_id: uuid.UUID, problems: list[dict]) -> None:
    """Store audit problems on the document for frontend display.

    INTERNAL: caller must validate document ownership before invoking.
    """
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(audit_problems=problems, updated_at=func.now())
    )
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="audit_results",
        payload={"doc_id": str(doc_id), "has_problems": True, "count": len(problems)},
    ))


async def clear_audit_problems(db: AsyncSession, doc_id: uuid.UUID) -> None:
    """Clear audit problems when audit passes.

    INTERNAL: caller must validate document ownership before invoking.
    """
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(audit_problems=None, updated_at=func.now())
    )
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="audit_results",
        payload={"doc_id": str(doc_id), "has_problems": False},
    ))


async def add_chat_message(
    db: AsyncSession,
    document_id: uuid.UUID,
    section_id: uuid.UUID,
    role: str,
    content: str,
) -> ChatMessage:
    msg = ChatMessage(
        document_id=document_id,
        section_id=section_id,
        role=role,
        content=content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


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


async def save_audit_findings(
    db: AsyncSession,
    doc_id: uuid.UUID,
    findings: list[dict],
) -> None:
    """Persist audit findings for a document. Each dict must have section_type, description, severity."""
    for f in findings:
        finding = AuditFinding(
            document_id=doc_id,
            section_type=f["section_type"],
            description=f["description"],
            severity=f["severity"],
        )
        db.add(finding)
    await db.commit()


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


async def get_prompt_template(
    db: AsyncSession,
    document_type_id: uuid.UUID,
    phase: str,
    section_key: str | None = None,
) -> PromptTemplate | None:
    """Fetch the most-specific prompt template: section-specific first, then phase-wide fallback."""
    if section_key:
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.document_type_id == document_type_id,
                PromptTemplate.phase == phase,
                PromptTemplate.section_key == section_key,
            )
        )
        tmpl = result.scalar_one_or_none()
        if tmpl:
            return tmpl

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.document_type_id == document_type_id,
            PromptTemplate.phase == phase,
            PromptTemplate.section_key.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def save_document_contract(
    db: AsyncSession,
    doc_id: uuid.UUID,
    contract: dict,
    raw_contract: str | None = None,
) -> DocumentContract:
    """Upsert the document contract. Only one contract per document is allowed."""
    result = await db.execute(
        select(DocumentContract).where(DocumentContract.document_id == doc_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.entities = contract.get("entities")
        existing.decisions = contract.get("decisions")
        existing.terminology = contract.get("terminology")
        existing.constraints = contract.get("constraints")
        existing.raw_contract = raw_contract
        await db.commit()
        await db.refresh(existing)
        return existing

    doc_contract = DocumentContract(
        document_id=doc_id,
        entities=contract.get("entities"),
        decisions=contract.get("decisions"),
        terminology=contract.get("terminology"),
        constraints=contract.get("constraints"),
        raw_contract=raw_contract,
    )
    db.add(doc_contract)
    await db.commit()
    await db.refresh(doc_contract)
    return doc_contract


async def get_document_contract(db: AsyncSession, doc_id: uuid.UUID) -> DocumentContract | None:
    result = await db.execute(
        select(DocumentContract).where(DocumentContract.document_id == doc_id)
    )
    return result.scalar_one_or_none()


async def get_document_detail(db: AsyncSession, doc_id: uuid.UUID):
    """Get document with sections (including active version content) and discovery questions."""
    result = await db.execute(
        select(Document)
        .options(
            selectinload(Document.sections).selectinload(Section.versions),
            selectinload(Document.discovery_questions),
        )
        .where(Document.id == doc_id)
    )
    return result.scalar_one_or_none()
