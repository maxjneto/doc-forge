import uuid
import datetime

import inngest
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Document, Section, DiscoveryQuestion
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

router = APIRouter(tags=["documents"])


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.updated_at.desc()))
    documents = result.scalars().all()
    logger.debug("[router] list_documents | count={}", len(documents))
    return DocumentListResponse(documents=[DocumentResponse.model_validate(d) for d in documents])


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    logger.debug("[router] get_document | doc_id={}", document_id)
    result = await db.execute(
        select(Document)
        .options(
            selectinload(Document.sections).selectinload(Section.versions),
            selectinload(Document.discovery_questions),
        )
        .where(Document.id == document_id)
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


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(payload: DocumentCreate, db: AsyncSession = Depends(get_db)):
    logger.info("[router] create_document | title='{}'", payload.title)
    doc = Document(
        title=payload.title,
        document_context=payload.document_context,
        user_preferences=payload.user_preferences,
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
):
    logger.info(
        "[router] answer_question | doc_id={} skipped={}",
        document_id,
        payload.answer is None,
    )
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

    # Dispatch Inngest event
    try:
        await inngest_client.send(
            inngest.Event(
                name="docforge/user.answered_question",
                data={
                    "document_id": str(document_id),
                    "question": payload.question,
                    "answer": payload.answer,
                },
            )
        )
    except Exception as e:
        logger.error(f"Failed to dispatch Inngest event for answer on {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to dispatch workflow event")

    return {"status": "ok"}


@router.post("/documents/{document_id}/events")
async def dispatch_event(
    document_id: uuid.UUID,
    payload: EventRequest,
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        "[router] dispatch_event | doc_id={} event_type={}",
        document_id,
        payload.event_type,
    )
    event_map = {
        "approved_alignment": "docforge/user.approved_alignment",
        "section_action": "docforge/user.section_action",
    }

    event_name = event_map.get(payload.event_type)
    if not event_name:
        raise HTTPException(status_code=400, detail=f"Unknown event_type: {payload.event_type}")

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
):
    logger.info("[router] update_completed_document_content | doc_id={}", document_id)

    result = await db.execute(
        select(Document).where(Document.id == document_id)
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
