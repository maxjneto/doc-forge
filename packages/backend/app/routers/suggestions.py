import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, Section, SectionVersion, Suggestion
from app.models.user import User
from app.schemas.suggestion import (
    FeedbackCreateRequest,
    FeedbackListResponse,
    FeedbackResolveRequest,
    FeedbackResponse,
    SuggestionCreateRequest,
    SuggestionListResponse,
    SuggestionRejectRequest,
    SuggestionResponse,
)
from app.services import db as db_service
from app.services.observability import capture_event

router = APIRouter(tags=["suggestions"])


async def _assert_document_ownership(
    document_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


async def _assert_suggestion_ownership(
    suggestion_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Suggestion:
    suggestion = await db_service.get_suggestion(db, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    await _assert_document_ownership(suggestion.document_id, current_user, db)
    return suggestion


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
    result = await db.execute(
        select(Section)
        .join(Document, Section.document_id == Document.id)
        .where(Section.id == section_id, Document.user_id == current_user.id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

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
    await _assert_document_ownership(document_id, current_user, db)
    suggestions = await db_service.list_suggestions(db, document_id, status=status)
    items = [await _to_response(db, s, include_content=include_content) for s in suggestions]
    return SuggestionListResponse(suggestions=items)


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def get_suggestion(
    suggestion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    suggestion = await _assert_suggestion_ownership(suggestion_id, current_user, db)
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


# ─── Feedback ────────────────────────────────────────────────

@router.post("/documents/{document_id}/feedback", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    document_id: uuid.UUID,
    payload: FeedbackCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_document_ownership(document_id, current_user, db)
    if payload.section_id is not None:
        result = await db.execute(
            select(Section).where(
                Section.id == payload.section_id, Section.document_id == document_id
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Section not found in this document")

    feedback = await db_service.create_feedback(
        db, document_id, payload.content,
        section_id=payload.section_id,
        author_user_id=current_user.id,
    )
    return FeedbackResponse.model_validate(feedback)


@router.get("/documents/{document_id}/feedback", response_model=FeedbackListResponse)
async def list_feedback(
    document_id: uuid.UUID,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_document_ownership(document_id, current_user, db)
    items = await db_service.list_feedback(db, document_id, status=status)
    return FeedbackListResponse(feedback=[FeedbackResponse.model_validate(f) for f in items])


@router.post("/feedback/{feedback_id}/resolve", response_model=FeedbackResponse)
async def resolve_feedback(
    request: Request,
    feedback_id: uuid.UUID,
    payload: FeedbackResolveRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = await db_service.get_feedback(db, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    await _assert_document_ownership(feedback.document_id, current_user, db)
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
    return FeedbackResponse.model_validate(feedback)
