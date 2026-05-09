import uuid
import datetime

import inngest
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, Section, DiscoveryQuestion, ChatMessage
from app.models.user import User
from app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentListResponse,
    DocumentDetailResponse,
    CompletedDocumentUpdateRequest,
    DiscoveryQuestionResponse,
    SectionBriefResponse,
)
from app.schemas.events import AnswerQuestionRequest, EventRequest
from app.inngest_client import inngest_client
from app.services import db as db_service
from app.services import sse as sse_service

router = APIRouter(tags=["documents"])


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.updated_at.desc())
    )
    documents = result.scalars().all()
    logger.debug("[router] list_documents | user_id={} count={}", current_user.id, len(documents))
    return DocumentListResponse(documents=[DocumentResponse.model_validate(d) for d in documents])


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.debug("[router] get_document | doc_id={} user_id={}", document_id, current_user.id)
    result = await db.execute(
        select(Document)
        .options(
            selectinload(Document.sections).selectinload(Section.versions),
            selectinload(Document.discovery_questions),
        )
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    sections = []
    for s in doc.sections:
        active_version = next((v for v in s.versions if v.is_active), None)
        sections.append(
            SectionBriefResponse(
                id=s.id,
                section_type=s.section_type,
                status=s.status,
                summary=s.summary,
                active_version_content=active_version.content if active_version else None,
            )
        )

    discovery_questions = [
        DiscoveryQuestionResponse.model_validate(q) for q in doc.discovery_questions
    ]

    return DocumentDetailResponse(
        document=DocumentResponse.model_validate(doc),
        sections=sections,
        discovery_questions=discovery_questions,
        audit_problems=doc.audit_problems,
    )


@router.get("/documents/{document_id}/stream")
async def stream_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.debug("[router] stream_document | doc_id={} user_id={}", document_id, current_user.id)
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    return StreamingResponse(
        sse_service.event_stream(str(document_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(
    payload: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] create_document | title='{}' user_id={}", payload.title, current_user.id)

    # Atomically deduct credit — prevents race conditions with concurrent requests
    result = await db.execute(
        update(User)
        .where(User.id == current_user.id, User.credits >= 1)
        .values(credits=User.credits - 1)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="No credits remaining. Credits reset weekly.",
        )
    await db.commit()

    doc = Document(
        title=payload.title,
        document_context=payload.document_context,
        user_preferences=payload.user_preferences,
        user_id=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Create the 4 sections
    section_types = ["context", "proposal", "implementation", "risks"]
    for st in section_types:
        section = Section(document_id=doc.id, section_type=st)
        db.add(section)
    await db.commit()

    # Dispatch Inngest event
    try:
        await inngest_client.send(
            inngest.Event(
                name="docforge/document.started",
                data={
                    "document_id": str(doc.id),
                    "document_context": payload.document_context,
                    "user_preferences": payload.user_preferences or "",
                },
            )
        )
    except Exception as e:
        logger.error(f"Failed to dispatch Inngest event for document {doc.id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to dispatch workflow event")

    return DocumentResponse.model_validate(doc)


@router.post("/documents/{document_id}/answer")
async def answer_question(
    document_id: uuid.UUID,
    payload: AnswerQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        "[router] answer_question | doc_id={} skipped={}",
        document_id,
        payload.answer is None,
    )
    # Verify ownership
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")
    # Mark the question as answered or skipped
    result = await db.execute(
        select(DiscoveryQuestion).where(
            DiscoveryQuestion.document_id == document_id,
            DiscoveryQuestion.question == payload.question,
            DiscoveryQuestion.answer.is_(None),
            DiscoveryQuestion.skipped == False,
        )
    )
    question = result.scalar_one_or_none()
    if question:
        if payload.answer is None:
            question.skipped = True
        else:
            question.answer = payload.answer
        await db.commit()

    # Check if all discovery questions for this document are now resolved.
    # If so, fire the round-complete signal so the orchestrator can proceed.
    try:
        pending_result = await db.execute(
            select(DiscoveryQuestion).where(
                DiscoveryQuestion.document_id == document_id,
                DiscoveryQuestion.answer.is_(None),
                DiscoveryQuestion.skipped == False,
            )
        )
        pending = pending_result.scalars().first()
        if pending is None:
            await inngest_client.send(
                inngest.Event(
                    name="docforge/user.discovery_round_complete",
                    data={"document_id": str(document_id)},
                )
            )
    except Exception as e:
        logger.error(f"Failed to dispatch round-complete event for {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to dispatch workflow event")

    return {"status": "ok"}


@router.post("/documents/{document_id}/events")
async def dispatch_event(
    document_id: uuid.UUID,
    payload: EventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        "[router] dispatch_event | doc_id={} event_type={}",
        document_id,
        payload.event_type,
    )
    # Verify ownership
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")
    event_map = {
        "approved_alignment": "docforge/user.approved_alignment",
        "section_action": "docforge/user.section_action",
    }

    event_name = event_map.get(payload.event_type)
    if not event_name:
        raise HTTPException(status_code=400, detail=f"Unknown event_type: {payload.event_type}")

    if payload.event_type == "section_action":
        action_type = payload.data.get("action_type")
        if action_type in ("ask_question", "request_edit", "analyze_user_edit"):
            try:
                section_uuid = uuid.UUID(str(payload.data.get("section_id", "")))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid section_id")
            count_result = await db.execute(
                select(func.count()).select_from(ChatMessage).where(
                    ChatMessage.section_id == section_uuid,
                    ChatMessage.role == "user",
                )
            )
            if count_result.scalar() >= 10:
                raise HTTPException(
                    status_code=429,
                    detail="Message limit reached for this section (10/10).",
                )

    event_data = {**payload.data, "document_id": str(document_id)}

    try:
        await inngest_client.send(
            inngest.Event(name=event_name, data=event_data)
        )
    except Exception as e:
        logger.error(f"Failed to dispatch Inngest event {event_name} for {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to dispatch workflow event")

    return {"status": "ok"}


@router.post("/documents/{document_id}/completed-content")
async def update_completed_document_content(
    document_id: uuid.UUID,
    payload: CompletedDocumentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] update_completed_document_content | doc_id={}", document_id)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.current_phase != "completed":
        raise HTTPException(status_code=409, detail="Document is not in completed phase")

    result = await db.execute(
        select(Section)
        .options(selectinload(Section.versions))
        .where(Section.document_id == document_id)
    )
    sections = result.scalars().all()
    section_by_type = {section.section_type: section for section in sections}

    required_types = {"context", "proposal", "implementation", "risks"}
    provided_types = {entry.section_type for entry in payload.sections}
    if provided_types != required_types:
        raise HTTPException(
            status_code=400,
            detail="sections must include exactly: context, proposal, implementation, risks",
        )

    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M:%S")
    version_name = f"Completed edit {timestamp}"

    for entry in payload.sections:
        section = section_by_type.get(entry.section_type)
        if not section:
            raise HTTPException(
                status_code=400,
                detail=f"Section not found for type: {entry.section_type}",
            )

        active_version = next((v for v in section.versions if v.is_active), None)
        await db_service.create_section_version(
            db,
            section.id,
            version_name,
            entry.content,
            parent_version_id=active_version.id if active_version else None,
        )

    return {"status": "ok"}
