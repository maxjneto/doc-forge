import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, Section, SectionVersion, Suggestion
from app.models.suggestion import Feedback
from app.models.user import User
from app.schemas.suggestion import (
    FeedbackCreateRequest,
    FeedbackListResponse,
    FeedbackReplyRequest,
    FeedbackResolveRequest,
    FeedbackResponse,
    FeedbackUpdateRequest,
    SuggestionCreateRequest,
    SuggestionListResponse,
    SuggestionRejectRequest,
    SuggestionResponse,
    SuggestionTriageRequest,
)
from app.services import access, actor
from app.services import db as db_service
from app.services.hunks import apply_hunks, diff_hunks
from app.services.observability import capture_event

router = APIRouter(tags=["suggestions"])


async def _assert_document_ownership(
    document_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    capability: access.Capability = "write",
) -> Document:
    return await access.require(db, document_id, current_user, capability)


async def _assert_suggestion_ownership(
    suggestion_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    capability: access.Capability = "write",
) -> Suggestion:
    suggestion = await db_service.get_suggestion(db, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    await _assert_document_ownership(suggestion.document_id, current_user, db, capability)
    return suggestion


async def _feedback_responses(db: AsyncSession, items: list[Feedback], me: str) -> list[FeedbackResponse]:
    """Feedback with its author named: the person, or the agent whose key wrote it."""
    people, agents = await actor.names_for(
        db, {f.author_user_id for f in items if f.author_user_id}, {f.api_key_id for f in items if f.api_key_id}
    )
    out = []
    for f in items:
        resp = FeedbackResponse.model_validate(f)
        agent = agents.get(f.api_key_id) if f.api_key_id else None
        if agent:
            resp.author_name, resp.harness, resp.by_agent = agent[0], agent[1], True
        elif f.author_user_id:
            resp.author_name = people.get(f.author_user_id)
            resp.is_mine = f.author_user_id == me
        out.append(resp)
    return out


async def _to_response(
    db: AsyncSession, suggestion: Suggestion, include_content: bool = True
) -> SuggestionResponse:
    resp = SuggestionResponse.model_validate(suggestion)
    resp.agent_name = suggestion.api_key.name if suggestion.api_key else None

    active_result = await db.execute(
        select(SectionVersion).where(
            SectionVersion.section_id == suggestion.section_id,
            SectionVersion.is_active.is_(True),
        )
    )
    active = active_result.scalar_one_or_none()
    # Stale = the document moved on while this suggestion sat pending
    resp.is_stale = (
        suggestion.status == "pending"
        and active is not None
        and suggestion.base_version_id is not None
        and active.id != suggestion.base_version_id
    )
    if include_content:
        resp.proposed_content = (
            suggestion.proposed_version.content if suggestion.proposed_version else None
        )
        resp.current_content = active.content if active else None
    return resp


# ─── Suggestions ─────────────────────────────────────────────

@router.post("/sections/{section_id}/suggestions", response_model=SuggestionResponse, status_code=201)
async def create_suggestion(
    request: Request,
    section_id: uuid.UUID,
    payload: SuggestionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Explicitly propose new content for a section (regardless of document policy)."""
    section = (await db.execute(select(Section).where(Section.id == section_id))).scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await _assert_document_ownership(section.document_id, current_user, db)

    api_key_id = getattr(request.state, "api_key_id", None)
    created = await db_service.create_suggestion(
        db, section_id, section.document_id, payload.content,
        note=payload.note, api_key_id=api_key_id,
    )
    # Re-fetch with relationships eager-loaded for the response
    suggestion = await db_service.get_suggestion(db, created.id)
    if api_key_id:
        capture_event(str(current_user.id), str(section.document_id), "mcp_suggestion_created", {
            "content_length": len(payload.content),
            "has_note": bool(payload.note),
        })
    return await _to_response(db, suggestion)


@router.get("/documents/{document_id}/suggestions", response_model=SuggestionListResponse)
async def list_suggestions(
    document_id: uuid.UUID,
    status: str | None = None,
    include_content: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_document_ownership(document_id, current_user, db, "read")
    suggestions = await db_service.list_suggestions(db, document_id, status=status)
    items = [await _to_response(db, s, include_content=include_content) for s in suggestions]
    return SuggestionListResponse(suggestions=items)


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def get_suggestion(
    suggestion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    suggestion = await _assert_suggestion_ownership(suggestion_id, current_user, db, "read")
    return await _to_response(db, suggestion)


@router.post("/suggestions/{suggestion_id}/accept", response_model=SuggestionResponse)
async def accept_suggestion(
    request: Request,
    suggestion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] accept_suggestion | suggestion_id={}", suggestion_id)
    suggestion = await _assert_suggestion_ownership(suggestion_id, current_user, db)
    if suggestion.status != "pending":
        raise HTTPException(status_code=409, detail=f"Suggestion is already {suggestion.status}")

    # Optional quality gate (M5): block acceptance while open high-severity
    # findings exist on the document — resolve them or dismiss them first.
    doc_result = await db.execute(
        select(Document).where(Document.id == suggestion.document_id)
    )
    doc = doc_result.scalar_one()
    if doc.require_gate_on_accept:
        from app.routers.quality_gate import open_high_findings

        high = await open_high_findings(db, suggestion.document_id)
        if high > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Quality gate: {high} open high-severity finding(s) on this "
                    "document. Resolve or dismiss them before accepting."
                ),
            )

    await db_service.accept_suggestion(db, suggestion)
    suggestion = await db_service.get_suggestion(db, suggestion_id)
    capture_event(str(current_user.id), str(suggestion.document_id), "suggestion_accepted", {})
    return await _to_response(db, suggestion)


@router.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionResponse)
async def reject_suggestion(
    suggestion_id: uuid.UUID,
    payload: SuggestionRejectRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] reject_suggestion | suggestion_id={}", suggestion_id)
    suggestion = await _assert_suggestion_ownership(suggestion_id, current_user, db)
    if suggestion.status != "pending":
        raise HTTPException(status_code=409, detail=f"Suggestion is already {suggestion.status}")

    comment = payload.comment if payload else None
    await db_service.reject_suggestion(
        db, suggestion, comment=comment, author_user_id=current_user.id
    )
    suggestion = await db_service.get_suggestion(db, suggestion_id)
    capture_event(str(current_user.id), str(suggestion.document_id), "suggestion_rejected", {
        "has_comment": bool(comment),
    })
    return await _to_response(db, suggestion)


@router.post("/suggestions/{suggestion_id}/triage", response_model=SuggestionResponse)
async def triage_suggestion(
    suggestion_id: uuid.UUID,
    payload: SuggestionTriageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept some of a proposal's changes and turn the rest down.

    The result is `base + accepted hunks`, computed server-side: the browser
    numbers the changes for the reviewer, but it does not get to decide what
    the document becomes. Accepting every index is equivalent to /accept;
    accepting none is equivalent to /reject.
    """
    logger.info(
        "[router] triage_suggestion | suggestion_id={} | accepted={}",
        suggestion_id,
        payload.accepted_indexes,
    )
    suggestion = await _assert_suggestion_ownership(suggestion_id, current_user, db)
    if suggestion.status != "pending":
        raise HTTPException(status_code=409, detail=f"Suggestion is already {suggestion.status}")

    base_result = await db.execute(
        select(SectionVersion).where(
            SectionVersion.section_id == suggestion.section_id,
            SectionVersion.is_active.is_(True),
        )
    )
    base_version = base_result.scalar_one_or_none()
    base_text = base_version.content if base_version else ""

    proposed_result = await db.execute(
        select(SectionVersion).where(SectionVersion.id == suggestion.proposed_version_id)
    )
    proposed_version = proposed_result.scalar_one_or_none()
    if proposed_version is None:
        raise HTTPException(status_code=404, detail="Proposed version not found")

    hunks = diff_hunks(base_text, proposed_version.content)
    valid = {h.index for h in hunks}
    unknown = [i for i in payload.accepted_indexes if i not in valid]
    if unknown:
        # The document moved under the reviewer; re-read it rather than
        # applying changes that no longer mean what they saw.
        raise HTTPException(
            status_code=409,
            detail=(
                f"Change(s) {unknown} no longer exist in this proposal "
                f"(it now has {len(hunks)}). Reload and review again."
            ),
        )

    accepted = set(payload.accepted_indexes)
    rejected = sorted(valid - accepted)

    if not accepted:
        await db_service.reject_suggestion(
            db, suggestion, comment=payload.comment, author_user_id=current_user.id
        )
        suggestion = await db_service.get_suggestion(db, suggestion_id)
        capture_event(str(current_user.id), str(suggestion.document_id), "suggestion_rejected", {
            "via": "triage",
        })
        return await _to_response(db, suggestion)

    merged = apply_hunks(base_text, proposed_version.content, accepted)

    if rejected:
        # Partial acceptance: the merged text is a new thing, neither the base
        # nor what the agent proposed, so it becomes its own version.
        await db_service.create_section_version(
            db,
            suggestion.section_id,
            f"Triagem — {len(accepted)}/{len(hunks)} aceitas",
            merged,
            doc_id=suggestion.document_id,
        )
        suggestion.status = "accepted"
        suggestion.review_comment = payload.comment
        from datetime import datetime, timezone

        suggestion.resolved_at = datetime.now(timezone.utc)

        # Closing the loop: the agent needs to know which changes were turned
        # down and why, or it will propose them again.
        detail = f"Recusadas as mudanças {rejected} de {len(hunks)}."
        db.add(
            Feedback(
                document_id=suggestion.document_id,
                section_id=suggestion.section_id,
                suggestion_id=suggestion.id,
                author_user_id=current_user.id,
                content=f"{detail} {payload.comment}".strip() if payload.comment else detail,
            )
        )
        await db.commit()
    else:
        await db_service.accept_suggestion(db, suggestion)

    await db_service.log_activity(
        db,
        suggestion.document_id,
        "suggestion_triaged",
        description=f"{len(accepted)} de {len(hunks)} mudanças aceitas",
    )
    await db.commit()

    suggestion = await db_service.get_suggestion(db, suggestion_id)
    capture_event(str(current_user.id), str(suggestion.document_id), "suggestion_triaged", {
        "accepted": len(accepted),
        "total": len(hunks),
    })
    return await _to_response(db, suggestion)


# ─── Feedback ────────────────────────────────────────────────

@router.post("/documents/{document_id}/feedback", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    request: Request,
    document_id: uuid.UUID,
    payload: FeedbackCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A comment on the document, optionally on a passage and for the agent."""
    await _assert_document_ownership(document_id, current_user, db, "comment")
    if payload.section_id is not None:
        result = await db.execute(
            select(Section).where(
                Section.id == payload.section_id, Section.document_id == document_id
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Section not found in this document")

    api_key_id = getattr(request.state, "api_key_id", None)
    feedback = await db_service.create_feedback(
        db, document_id, payload.content,
        section_id=payload.section_id,
        author_user_id=None if api_key_id else current_user.id,
        api_key_id=api_key_id,
        anchor=payload.anchor.model_dump(exclude_none=True) if payload.anchor else None,
        for_agent=payload.for_agent,
    )
    return (await _feedback_responses(db, [feedback], current_user.id))[0]


@router.get("/documents/{document_id}/feedback", response_model=FeedbackListResponse)
async def list_feedback(
    document_id: uuid.UUID,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Comment threads: roots with `status`, followed by their replies (`parent_id`)."""
    await _assert_document_ownership(document_id, current_user, db, "read")
    items = await db_service.list_feedback(db, document_id, status=status)
    return FeedbackListResponse(feedback=await _feedback_responses(db, items, current_user.id))


async def _thread_root(feedback_id: uuid.UUID, current_user: User, db: AsyncSession) -> Feedback:
    feedback = await db_service.get_feedback(db, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    await _assert_document_ownership(feedback.document_id, current_user, db, "comment")
    if feedback.parent_id is not None:
        # Replies have no state of their own; the thread is managed at its root.
        root = await db_service.get_feedback(db, feedback.parent_id)
        if root:
            return root
    return feedback


@router.post("/feedback/{feedback_id}/replies", response_model=FeedbackResponse, status_code=201)
async def reply_feedback(
    request: Request,
    feedback_id: uuid.UUID,
    payload: FeedbackReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Answer in a comment's thread: a person in the browser, or an agent via MCP."""
    root = await _thread_root(feedback_id, current_user, db)
    api_key_id = getattr(request.state, "api_key_id", None)
    reply = await db_service.create_feedback(
        db, root.document_id, payload.content,
        section_id=root.section_id,
        author_user_id=None if api_key_id else current_user.id,
        api_key_id=api_key_id,
        parent_id=root.id,
    )
    if api_key_id:
        capture_event(str(current_user.id), str(root.document_id), "mcp_feedback_replied", {})
    return (await _feedback_responses(db, [reply], current_user.id))[0]


@router.patch("/feedback/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: uuid.UUID,
    payload: FeedbackUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    root = await _thread_root(feedback_id, current_user, db)
    root = await db_service.update_feedback(
        db, root, reopen=payload.status == "open", for_agent=payload.for_agent
    )
    return (await _feedback_responses(db, [root], current_user.id))[0]


@router.post("/feedback/{feedback_id}/resolve", response_model=FeedbackResponse)
async def resolve_feedback(
    request: Request,
    feedback_id: uuid.UUID,
    payload: FeedbackResolveRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = await _thread_root(feedback_id, current_user, db)
    if feedback.status not in ("open", "addressed"):
        raise HTTPException(status_code=409, detail=f"Feedback is already {feedback.status}")

    api_key_id = getattr(request.state, "api_key_id", None)
    feedback = await db_service.resolve_feedback(
        db, feedback,
        status=payload.status if payload else "resolved",
        resolution_note=payload.resolution_note if payload else None,
        api_key_id=api_key_id,
    )
    if api_key_id:
        capture_event(str(current_user.id), str(feedback.document_id), "mcp_feedback_resolved", {})
    return (await _feedback_responses(db, [feedback], current_user.id))[0]
