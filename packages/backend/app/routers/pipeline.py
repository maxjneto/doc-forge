import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Document
from app.models.document_type import DocumentType
from app.models.user import User
from app.schemas.pipeline import (
    PipelineRunResponse,
    PipelineStartRequest,
    PipelineStartResponse,
    PipelineSubmitRequest,
)
from app.services import pipeline as pipeline_service
from app.services.observability import capture_event
from app.services.pipeline import PipelineError

router = APIRouter(tags=["pipeline"])


async def _get_owned_pipeline(
    document_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> tuple[Document, "pipeline_service.PipelineRun"]:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    run = await pipeline_service.get_run(db, document_id)
    if not run:
        raise HTTPException(status_code=404, detail="No pipeline for this document")
    return doc, run


@router.post("/pipeline/documents", response_model=PipelineStartResponse, status_code=201)
async def start_pipeline_document(
    request: Request,
    payload: PipelineStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a document driven by a BYOA pipeline (agent executes, human checkpoints)."""
    logger.info(
        "[router] start_pipeline | type={} definition={} user_id={}",
        payload.document_type_slug, payload.pipeline_definition_id, current_user.id,
    )

    definition = None
    if payload.pipeline_definition_id is not None:
        from app.models import PipelineDefinition

        def_result = await db.execute(
            select(PipelineDefinition).where(
                PipelineDefinition.id == payload.pipeline_definition_id,
                PipelineDefinition.user_id == current_user.id,
            )
        )
        definition = def_result.scalar_one_or_none()
        if not definition:
            raise HTTPException(status_code=404, detail="Pipeline definition not found")

    type_filter = (
        DocumentType.id == definition.base_document_type_id
        if definition is not None and definition.base_document_type_id is not None
        else DocumentType.slug == payload.document_type_slug
    )
    # Visibility: global (seeded) types, or custom types the caller owns
    visibility = or_(
        DocumentType.user_id.is_(None), DocumentType.user_id == current_user.id
    )
    dt_result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(type_filter, DocumentType.is_active.is_(True), visibility)
    )
    doc_type = dt_result.scalar_one_or_none()
    if not doc_type:
        raise HTTPException(
            status_code=400, detail=f"Unknown document type: {payload.document_type_slug}"
        )

    from app.services import tiers as tiers_service
    limit_error = await tiers_service.check_document_limit(db, current_user)
    if limit_error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=limit_error)

    # BYOA route is cheap to serve — costs the editor-document credit, not the guided one
    cost = settings.EDITOR_DOCUMENT_COST
    result = await db.execute(
        update(User)
        .where(User.id == current_user.id, User.credits >= cost)
        .values(credits=User.credits - cost)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="No credits remaining. Credits reset weekly.",
        )
    await db.commit()

    doc, run = await pipeline_service.start_pipeline(
        db, current_user.id, doc_type, payload.title, payload.document_context,
        definition=definition,
    )
    api_key_id = getattr(request.state, "api_key_id", None)
    if api_key_id:
        capture_event(str(current_user.id), str(doc.id), "mcp_pipeline_started", {
            "document_type": payload.document_type_slug,
        })
    next_step = await pipeline_service.describe_next_step(db, doc, run)
    return PipelineStartResponse(
        document_id=doc.id,
        title=doc.title,
        run=PipelineRunResponse.model_validate(run),
        next_step=next_step,
    )


@router.get("/documents/{document_id}/pipeline", response_model=PipelineRunResponse)
async def get_pipeline_run(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, run = await _get_owned_pipeline(document_id, current_user, db)
    return PipelineRunResponse.model_validate(run)


@router.get("/documents/{document_id}/pipeline/next-step")
async def get_next_step(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc, run = await _get_owned_pipeline(document_id, current_user, db)
    return await pipeline_service.describe_next_step(db, doc, run)


@router.post("/documents/{document_id}/pipeline/submit")
async def submit_step(
    request: Request,
    document_id: uuid.UUID,
    payload: PipelineSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc, run = await _get_owned_pipeline(document_id, current_user, db)
    api_key_id = getattr(request.state, "api_key_id", None)
    try:
        result = await pipeline_service.submit_step(
            db, doc, run, payload.payload, api_key_id=api_key_id
        )
    except PipelineError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if api_key_id:
        capture_event(str(current_user.id), str(document_id), "mcp_pipeline_step_submitted", {
            "status": result.get("status"),
        })
    return result


@router.post("/documents/{document_id}/pipeline/approve")
async def approve_alignment(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Human checkpoint: approve alignment summaries (browser action)."""
    doc, run = await _get_owned_pipeline(document_id, current_user, db)
    try:
        result = await pipeline_service.approve_alignment(db, doc, run)
    except PipelineError as e:
        raise HTTPException(status_code=409, detail=str(e))
    capture_event(str(current_user.id), str(document_id), "pipeline_alignment_approved", {})
    return result


@router.post("/documents/{document_id}/pipeline/reject")
async def reject_alignment(
    document_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Human checkpoint: send summaries back to the agent with a comment."""
    doc, run = await _get_owned_pipeline(document_id, current_user, db)
    comment = str(payload.get("comment") or "")
    try:
        result = await pipeline_service.reject_alignment(
            db, doc, run, comment, author_user_id=current_user.id
        )
    except PipelineError as e:
        raise HTTPException(status_code=409, detail=str(e))
    capture_event(str(current_user.id), str(document_id), "pipeline_alignment_rejected", {})
    return result
