import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    AuditFinding,
    Document,
    Section,
    SectionVersion,
)
from app.models.user import User
from app.schemas.audit import AuditFindingResponse
from app.schemas.document import (
    DocumentCreate,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    SectionBriefResponse,
)
from app.services import access
from app.services import db as db_service
from app.services import export as export_service
from app.services import sse as sse_service
from app.services.observability import capture_event

router = APIRouter(tags=["documents"])


def _publication_fields_from_versions(versions: list[SectionVersion]) -> dict:
    """Derive the stable release pointer independently from the working draft."""
    active = next((v for v in versions if v.is_active), None)
    published = next((v for v in versions if v.is_published), None)
    return {
        "published_version_id": published.id if published else None,
        "published_at": published.published_at if published else None,
        "has_unpublished_changes": bool(active and (published is None or active.id != published.id)),
    }


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.api_key import ApiKey
    from app.models.document_activity import DocumentActivity

    statement = select(Document).where(Document.user_id == current_user.id)
    if not include_archived:
        statement = statement.where(Document.archived_at.is_(None))
    result = await db.execute(statement.order_by(Document.updated_at.desc()))
    documents = result.scalars().all()

    # Per-doc: the most recent API-key-attributed activity, joined to ApiKey.name.
    # NULL key_name means no agent has ever touched the doc.
    doc_ids = [d.id for d in documents]
    latest_agent_key: dict[uuid.UUID, str] = {}
    publication_by_doc: dict[uuid.UUID, dict] = {}
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

        publication_rows = await db.execute(
            select(
                Section.document_id,
                SectionVersion.id,
                SectionVersion.is_active,
                SectionVersion.is_published,
                SectionVersion.published_at,
            )
            .join(SectionVersion, SectionVersion.section_id == Section.id)
            .where(
                Section.document_id.in_(doc_ids),
                Section.section_type == "body",
                (SectionVersion.is_active.is_(True) | SectionVersion.is_published.is_(True)),
            )
        )
        for doc_id, version_id, is_active, is_published, published_at in publication_rows:
            state = publication_by_doc.setdefault(doc_id, {
                "active_version_id": None,
                "published_version_id": None,
                "published_at": None,
            })
            if is_active:
                state["active_version_id"] = version_id
            if is_published:
                state["published_version_id"] = version_id
                state["published_at"] = published_at

    items = []
    for d in documents:
        publication = publication_by_doc.get(d.id, {})
        active_id = publication.get("active_version_id")
        published_id = publication.get("published_version_id")
        item = DocumentResponse.model_validate(d).model_copy(update={
            "has_api_key_activity": d.id in latest_agent_key,
            "last_api_key_name": latest_agent_key.get(d.id),
            "published_version_id": published_id,
            "published_at": publication.get("published_at"),
            "has_unpublished_changes": bool(active_id and active_id != published_id),
        })
        items.append(item)

    logger.debug("[router] list_documents | user_id={} count={}", current_user.id, len(documents))
    return DocumentListResponse(documents=items)


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.debug("[router] get_document | doc_id={} user_id={}", document_id, current_user.id)
    # Access goes through the resolver, not an inline owner check: this
    # endpoint is reachable by anyone the document was shared with.
    await access.require(db, document_id, current_user, "read")
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.sections).selectinload(Section.versions))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one()

    sections = []
    for s in doc.sections:
        active_version = next((v for v in s.versions if v.is_active), None)
        sections.append(
            SectionBriefResponse(
                id=s.id,
                section_type=s.section_type,
                active_version_content=active_version.content if active_version else None,
            )
        )

    body = next((s for s in doc.sections if s.section_type == "body"), None)
    publication_fields = _publication_fields_from_versions(body.versions if body else [])

    return DocumentDetailResponse(
        document=DocumentResponse.model_validate(doc).model_copy(update=publication_fields),
        sections=sections,
    )


@router.get("/documents/{document_id}/export")
async def export_document(
    document_id: uuid.UUID,
    format: str = Query("md", description="md | pdf | docx"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export the document's active content as Markdown, PDF or Word.

    Markdown is free; PDF and DOCX are a Pro perk (see product-plan §9 / tiers).
    """
    fmt = format.lower()
    if fmt not in export_service.EXPORT_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}")
    await access.require(db, document_id, current_user, "read")
    from app.services import tiers as tiers_service
    allowed_formats = tiers_service.get_limits(current_user.plan).get("export_formats", [])
    if fmt not in allowed_formats:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{fmt.upper()} export is a Pro feature.",
        )
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.sections).selectinload(Section.versions))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one()

    if doc.document_mode != "editor":
        raise HTTPException(
            status_code=400,
            detail="Only Markdown documents export here; layout documents render through the layout service.",
        )
    # One Markdown blob the user/agent writes directly (headings included): no
    # heading to add, and prepending the title would duplicate one already there.
    body_section = next((s for s in doc.sections if s.section_type == "body"), None)
    active = next((v for v in body_section.versions if v.is_active), None) if body_section else None
    md = export_service.build_freeform_markdown(active.content if active else None)
    mime, ext = export_service.EXPORT_FORMATS[fmt]
    data = export_service.render(fmt, md)
    filename = export_service.safe_filename(doc.title, ext)
    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    logger.info("[router] create_document | title='{}' user_id={}", payload.title, current_user.id)

    from app.services import tiers as tiers_service
    limit_error = await tiers_service.check_document_limit(db, current_user)
    if limit_error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=limit_error)

    from app.services.credits import consume_document_creation, refund_document_creation

    await consume_document_creation(db, current_user)
    try:
        return await _create_editor_document(payload, db, current_user, request)
    except Exception:
        await refund_document_creation(db, current_user.id)
        raise


async def _create_editor_document(
    payload: DocumentCreate,
    db: AsyncSession,
    current_user: User,
    request: Request,
) -> DocumentResponse:
    """Create a Markdown document: one body section holding the whole text."""

    title = payload.title or f"Document — {datetime.datetime.now(datetime.UTC).strftime('%b %d, %Y')}"
    doc = Document(title=title, user_id=current_user.id, document_mode="editor")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    section = Section(document_id=doc.id, section_type="body")
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

    api_key_id = getattr(request.state, "api_key_id", None)
    if api_key_id:
        capture_event(str(current_user.id), str(doc.id), "mcp_document_created")
    await db_service.log_activity(
        db, doc.id, "document_created",
        description="Document created via Editor",
        api_key_id=api_key_id,
    )
    await db.commit()

    logger.info("[router] editor document created | doc_id={} section_id={}", doc.id, section.id)
    return DocumentResponse.model_validate(doc)


@router.post("/documents/{document_id}/archive", response_model=DocumentResponse)
async def archive_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Archive a document without deleting its content or history."""
    doc = await access.require(db, document_id, current_user, "manage")
    if doc.archived_at is None:
        doc.archived_at = datetime.datetime.now(datetime.timezone.utc)
        await db_service.log_activity(
            db, document_id, "document_archived", description="Document archived"
        )
        await db.commit()
        await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.post("/documents/{document_id}/restore", response_model=DocumentResponse)
async def restore_archived_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore an archived document when the active-document limit allows it."""
    doc = await access.require(db, document_id, current_user, "manage")
    if doc.archived_at is not None:
        from app.services import tiers as tiers_service

        limit_error = await tiers_service.check_document_limit(db, current_user)
        if limit_error:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=limit_error)
        doc.archived_at = None
        await db_service.log_activity(
            db, document_id, "document_restored", description="Document restored"
        )
        await db.commit()
        await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


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


# ─── Publication ─────────────────────────────────────────────


class PublishResponse(BaseModel):
    published_version_id: str
    published_at: datetime.datetime
    label: str


@router.post("/documents/{document_id}/publish", response_model=PublishResponse)
async def publish_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sign off on the current draft.

    The active version is the working draft; publishing marks it as the one
    people are meant to read. Blocking gate findings stop it — that is the
    whole point of the gate being a gate rather than a report.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.routers.quality_gate import open_high_findings

    blocking = await open_high_findings(db, document_id)
    if blocking > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{blocking} bloqueante(s) em aberto no gate de qualidade. "
                "Resolva ou descarte antes de publicar."
            ),
        )

    body_result = await db.execute(
        select(SectionVersion)
        .join(Section, Section.id == SectionVersion.section_id)
        .where(
            Section.document_id == document_id,
            Section.section_type == "body",
            SectionVersion.is_active.is_(True),
        )
    )
    active = body_result.scalar_one_or_none()
    if active is None:
        raise HTTPException(status_code=409, detail="Nothing to publish yet")

    previous = await db.execute(
        select(SectionVersion).where(
            SectionVersion.section_id == active.section_id,
            SectionVersion.is_published.is_(True),
        )
    )
    for old in previous.scalars().all():
        old.is_published = False

    active.is_published = True
    active.published_at = datetime.datetime.now(datetime.timezone.utc)

    await db_service.log_activity(
        db, document_id, "document_published", description=f"Publicado: {active.version_name}"
    )
    await db.commit()
    await db.refresh(active)

    return PublishResponse(
        published_version_id=str(active.id),
        published_at=active.published_at,
        label=active.version_name,
    )
