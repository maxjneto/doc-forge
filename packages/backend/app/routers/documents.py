import datetime
import json
import uuid
from pathlib import Path

import inngest
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.guardrails import (
    validate_discovery_answer,
    validate_document_context,
    validate_refinement_message,
)
from app.inngest_client import inngest_client
from app.models import (
    AuditFinding,
    ChatMessage,
    DiscoveryQuestion,
    Document,
    Section,
    SectionVersion,
)
from app.models.document_type import DocumentType
from app.models.user import User
from app.schemas.audit import AuditFindingResponse
from app.schemas.document import (
    CompletedDocumentUpdateRequest,
    DiscoveryQuestionResponse,
    DocumentCreate,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    SectionBriefResponse,
)
from app.schemas.events import AnswerQuestionRequest, EventRequest
from app.services import db as db_service
from app.services import sse as sse_service
from app.services.observability import capture_event, capture_trace

router = APIRouter(tags=["documents"])

_SAMPLE_FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "sample_document.json"
_sample_document: dict | None = None


def _load_sample_document() -> dict:
    global _sample_document
    if _sample_document is None:
        _sample_document = json.loads(_SAMPLE_FIXTURE_PATH.read_text(encoding="utf-8"))
    return _sample_document


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.api_key import ApiKey
    from app.models.document_activity import DocumentActivity

    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.updated_at.desc())
    )
    documents = result.scalars().all()

    # Per-doc: the most recent API-key-attributed activity, joined to ApiKey.name.
    # NULL key_name means no agent has ever touched the doc.
    doc_ids = [d.id for d in documents]
    latest_agent_key: dict[uuid.UUID, str] = {}
    if doc_ids:
        agent_rows = await db.execute(
            select(DocumentActivity.document_id, ApiKey.name, DocumentActivity.created_at)
            .join(ApiKey, DocumentActivity.api_key_id == ApiKey.id)
            .where(DocumentActivity.document_id.in_(doc_ids))
            .order_by(DocumentActivity.created_at.desc())
        )
        for doc_id, key_name, _ in agent_rows:
            # Keep only the first (most recent) hit per doc_id
            if doc_id not in latest_agent_key:
                latest_agent_key[doc_id] = key_name

    items = []
    for d in documents:
        item = DocumentResponse.model_validate(d).model_copy(update={
            "has_api_key_activity": d.id in latest_agent_key,
            "last_api_key_name": latest_agent_key.get(d.id),
        })
        items.append(item)

    logger.debug("[router] list_documents | user_id={} count={}", current_user.id, len(documents))
    return DocumentListResponse(documents=items)


@router.get("/documents/sample", response_model=DocumentDetailResponse)
async def get_sample_document():
    """Return a static completed sample RFC document. No auth required."""
    return _load_sample_document()


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


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if payload.title is not None:
        doc.title = payload.title
    if payload.agent_write_policy is not None:
        doc.agent_write_policy = payload.agent_write_policy
    if payload.require_gate_on_accept is not None:
        doc.require_gate_on_accept = payload.require_gate_on_accept
    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


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
    request: Request,
    payload: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] create_document | title='{}' mode='{}' user_id={}", payload.title, payload.mode, current_user.id)

    from app.services import tiers as tiers_service
    limit_error = await tiers_service.check_document_limit(db, current_user)
    if limit_error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=limit_error)

    if payload.mode == "editor":
        return await _create_editor_document(payload, db, current_user, request)

    # ── Guided mode ──────────────────────────────────────────────

    # Validate input before touching DB or credits
    err = validate_document_context(payload.document_context)
    if err:
        raise HTTPException(status_code=422, detail={"field": err.field, "message": err.message})

    # Resolve document type — global (seeded) or a custom type the caller owns
    from sqlalchemy import or_
    dt_result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(
            DocumentType.slug == payload.document_type_slug,
            DocumentType.is_active.is_(True),
            or_(DocumentType.user_id.is_(None), DocumentType.user_id == current_user.id),
        )
    )
    doc_type = dt_result.scalar_one_or_none()
    if not doc_type:
        raise HTTPException(status_code=400, detail=f"Unknown document type: {payload.document_type_slug}")

    # Atomically deduct credit — prevents race conditions with concurrent requests
    cost = settings.GUIDED_DOCUMENT_COST
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

    doc = Document(
        title=payload.title or f"{doc_type.name} — {datetime.datetime.utcnow().strftime('%b %d, %Y')}",
        document_context=payload.document_context,
        user_preferences=payload.user_preferences,
        user_id=current_user.id,
        document_type_id=doc_type.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Create sections from SectionDefinition order
    for sd in sorted(doc_type.section_definitions, key=lambda s: s.order):
        section = Section(document_id=doc.id, section_type=sd.section_key)
        db.add(section)
    await db.commit()

    # Dispatch Inngest event
    capture_trace(str(current_user.id), str(doc.id), span_name=doc.title, input_state=payload.document_context)
    try:
        await inngest_client.send(
            inngest.Event(
                name="docforge/document.started",
                data={
                    "document_id": str(doc.id),
                    "document_context": payload.document_context,
                    "user_preferences": payload.user_preferences or "",
                    "document_type_id": str(doc_type.id),
                    "user_id": str(current_user.id),
                },
            )
        )
    except Exception as e:
        logger.error(f"Failed to dispatch Inngest event for document {doc.id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to dispatch workflow event")

    return DocumentResponse.model_validate(doc)


async def _create_editor_document(
    payload: DocumentCreate,
    db: AsyncSession,
    current_user: User,
    request: Request,
) -> DocumentResponse:
    """Create a free-editor document: one body section, no workflow, no Inngest."""
    # Atomically deduct credit
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

    title = payload.title or f"Document — {datetime.datetime.utcnow().strftime('%b %d, %Y')}"
    doc = Document(
        title=title,
        document_context="",
        user_preferences=payload.user_preferences,
        user_id=current_user.id,
        current_phase="editing",
        document_mode="editor",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    section = Section(document_id=doc.id, section_type="body", status="refining")
    db.add(section)
    await db.commit()
    await db.refresh(section)

    version = SectionVersion(
        section_id=section.id,
        version_name="Draft",
        content="",
        is_active=True,
    )
    db.add(version)
    await db.commit()

    from app.schemas.sse import SSEEvent
    sse_service.publish(str(doc.id), SSEEvent(
        type="phase_changed",
        payload={"doc_id": str(doc.id), "phase": "editing"},
    ))

    api_key_id = getattr(request.state, "api_key_id", None)
    if api_key_id:
        capture_event(str(current_user.id), str(doc.id), "mcp_document_created", {"has_context": bool(payload.user_preferences)})
    await db_service.log_activity(
        db, doc.id, "document_created",
        description="Document created via Editor",
        api_key_id=api_key_id,
    )
    await db.commit()

    logger.info("[router] editor document created | doc_id={} section_id={}", doc.id, section.id)
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

    if payload.answer is not None:
        err = validate_discovery_answer(payload.answer)
        if err:
            raise HTTPException(status_code=422, detail={"field": err.field, "message": err.message})

    # Verify ownership
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")
    # Mark the question as answered or skipped.
    # section_key is NOT taken from the request — it is read from the DB row
    # (set by the workflow when saving questions) so the client doesn't need to track it.
    result = await db.execute(
        select(DiscoveryQuestion).where(
            DiscoveryQuestion.document_id == document_id,
            DiscoveryQuestion.question == payload.question,
            DiscoveryQuestion.answer.is_(None),
            DiscoveryQuestion.skipped.is_(False),
        )
    )
    question = result.scalar_one_or_none()
    section_key = question.section_key if question else None
    if question:
        if payload.answer is None:
            question.skipped = True
        else:
            question.answer = payload.answer
        await db.commit()

    # Check if all pending questions for this section (or document, for legacy rows)
    # are resolved. If so, fire the round-complete signal to resume the Inngest wait.
    try:
        if section_key is not None:
            pending_result = await db.execute(
                select(DiscoveryQuestion).where(
                    DiscoveryQuestion.document_id == document_id,
                    DiscoveryQuestion.section_key == section_key,
                    DiscoveryQuestion.answer.is_(None),
                    DiscoveryQuestion.skipped.is_(False),
                )
            )
        else:
            # Legacy path: document predates per-section discovery (section_key is NULL)
            pending_result = await db.execute(
                select(DiscoveryQuestion).where(
                    DiscoveryQuestion.document_id == document_id,
                    DiscoveryQuestion.answer.is_(None),
                    DiscoveryQuestion.skipped.is_(False),
                )
            )
        pending = pending_result.scalars().first()
        if pending is None:
            event_data: dict = {"document_id": str(document_id)}
            if section_key is not None:
                event_data["section_key"] = section_key
            await inngest_client.send(
                inngest.Event(
                    name="docforge/user.discovery_round_complete",
                    data=event_data,
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
        if action_type in ("ask_question", "request_edit"):
            msg = payload.data.get("prompt") or payload.data.get("message") or ""
            err = validate_refinement_message(str(msg))
            if err:
                raise HTTPException(status_code=422, detail={"field": err.field, "message": err.message})
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

    event_data = {**payload.data, "document_id": str(document_id), "user_id": str(current_user.id)}

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


@router.get("/documents/{document_id}/audit-findings", response_model=list[AuditFindingResponse])
async def get_audit_findings(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.debug("[router] get_audit_findings | doc_id={}", document_id)
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    findings = await db_service.get_audit_findings(db, document_id)
    return [AuditFindingResponse.model_validate(f) for f in findings]


@router.post("/documents/{document_id}/audit-findings/{finding_id}/dismiss")
async def dismiss_audit_finding(
    document_id: uuid.UUID,
    finding_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] dismiss_audit_finding | doc_id={} finding_id={}", document_id, finding_id)
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    finding_result = await db.execute(
        select(AuditFinding).where(
            AuditFinding.id == finding_id,
            AuditFinding.document_id == document_id,
        )
    )
    if not finding_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Finding not found")

    await db_service.dismiss_audit_finding(db, finding_id)
    return {"status": "ok"}


@router.post("/documents/{document_id}/rerun-audit")
async def rerun_audit(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-trigger the audit phase for a document currently in refinement.

    Sends the existing docforge/document.refinement_completed event so the
    run-audit Inngest function executes exactly as it would after normal
    refinement completion — no audit logic lives here.
    """
    logger.info("[router] rerun_audit | doc_id={} user_id={}", document_id, current_user.id)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.current_phase != "refinement":
        raise HTTPException(status_code=409, detail="Document is not in refinement phase")

    try:
        await inngest_client.send(
            inngest.Event(
                name="docforge/document.refinement_completed",
                data={
                    "document_id": str(document_id),
                    "document_type_id": str(doc.document_type_id) if doc.document_type_id else None,
                },
            )
        )
    except Exception as e:
        logger.error(f"Failed to dispatch rerun-audit event for {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to dispatch workflow event")

    return {"status": "ok"}


@router.get("/documents/{document_id}/activity")
async def get_document_activity(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):

    from app.models.api_key import ApiKey
    from app.models.document_activity import DocumentActivity

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    rows = await db.execute(
        select(DocumentActivity, ApiKey.name, ApiKey.harness)
        .outerjoin(ApiKey, DocumentActivity.api_key_id == ApiKey.id)
        .where(DocumentActivity.document_id == document_id)
        .order_by(DocumentActivity.created_at.desc())
        .limit(limit)
    )
    entries = []
    for activity, key_name, key_harness in rows:
        entries.append({
            "id": str(activity.id),
            "action_type": activity.action_type,
            "description": activity.description,
            "actor_name": key_name if key_name else "You",
            "is_agent": key_name is not None,
            "harness": key_harness,
            "bytes_delta": activity.bytes_delta,
            "version_id": str(activity.version_id) if activity.version_id else None,
            "created_at": activity.created_at.isoformat() if activity.created_at else None,
        })
    return entries
