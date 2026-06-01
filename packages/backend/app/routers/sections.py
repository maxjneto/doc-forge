import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import ChatMessage, Document, Section, SectionVersion
from app.models.user import User
from app.schemas.section import (
    ChatMessageResponse,
    SectionContentUpdateRequest,
    SectionSnapshotRequest,
    SectionVersionResponse,
    SectionVersionUpdateRequest,
    VersionRestoreResponse,
)
from app.services.db import create_version_snapshot, restore_version, update_section_content
from app.services.observability import capture_event

router = APIRouter(tags=["sections"])


async def _assert_section_ownership(
    section_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Section:
    result = await db.execute(
        select(Section)
        .join(Document, Section.document_id == Document.id)
        .where(Section.id == section_id, Document.user_id == current_user.id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.get("/sections/{section_id}/versions", response_model=list[SectionVersionResponse])
async def get_section_versions(
    section_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.debug("[router] get_section_versions | section_id={}", section_id)
    await _assert_section_ownership(section_id, current_user, db)
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id)
        .order_by(SectionVersion.created_at)
    )
    versions = result.scalars().all()
    return [SectionVersionResponse.model_validate(v) for v in versions]


@router.get("/sections/{section_id}/chat", response_model=list[ChatMessageResponse])
async def get_section_chat(
    section_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_section_ownership(section_id, current_user, db)
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.section_id == section_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [ChatMessageResponse.model_validate(m) for m in messages]


@router.post("/sections/{section_id}/versions/snapshot", response_model=SectionVersionResponse, status_code=201)
async def create_section_snapshot(
    request: Request,
    section_id: uuid.UUID,
    payload: SectionSnapshotRequest | None = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[router] create_section_snapshot | section_id={}", section_id)
    section = await _assert_section_ownership(section_id, current_user, db)
    api_key_id = getattr(request.state, "api_key_id", None)

    try:
        version = await create_version_snapshot(
            db,
            section_id,
            section.document_id,
            version_name=payload.version_name if payload else None,
            change_summary=payload.change_summary if payload else None,
            api_key_id=api_key_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    if api_key_id:
        capture_event(str(current_user.id), str(section.document_id), "mcp_snapshot_saved", {
            "has_name": bool(payload.version_name if payload else None),
            "has_summary": bool(payload.change_summary if payload else None),
        })

    return SectionVersionResponse.model_validate(version)


@router.patch("/sections/{section_id}/versions/{version_id}", response_model=SectionVersionResponse)
async def update_section_version(
    section_id: uuid.UUID,
    version_id: uuid.UUID,
    payload: SectionVersionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await _assert_section_ownership(section_id, current_user, db)
    result = await db.execute(
        select(SectionVersion).where(
            SectionVersion.id == version_id,
            SectionVersion.section_id == section_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found for this section")
    version.change_summary = payload.change_summary
    if payload.version_name is not None:
        version.version_name = payload.version_name
    await db.commit()
    await db.refresh(version)

    from app.schemas.sse import SSEEvent
    from app.services import sse as sse_service
    sse_service.publish(str(section.document_id), SSEEvent(
        type="section_updated",
        payload={"doc_id": str(section.document_id), "section_id": str(section_id)},
    ))

    return SectionVersionResponse.model_validate(version)


@router.patch("/sections/{section_id}/content", response_model=SectionVersionResponse)
async def update_section_content_endpoint(
    request: Request,
    section_id: uuid.UUID,
    payload: SectionContentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await _assert_section_ownership(section_id, current_user, db)
    api_key_id = getattr(request.state, "api_key_id", None)
    note = getattr(payload, "note", None)
    try:
        version = await update_section_content(
            db, section_id, payload.content,
            doc_id=section.document_id,
            api_key_id=api_key_id,
            note=note,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    if api_key_id:
        capture_event(str(current_user.id), str(section.document_id), "mcp_section_written", {
            "content_length": len(payload.content),
            "has_note": bool(note),
        })

    return SectionVersionResponse.model_validate(version)


@router.post("/sections/{section_id}/versions/{version_id}/restore", response_model=VersionRestoreResponse)
async def restore_section_version(
    request: Request,
    section_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        "[router] restore_version | section_id={} version_id={}",
        section_id,
        version_id,
    )
    section = await _assert_section_ownership(section_id, current_user, db)
    api_key_id = getattr(request.state, "api_key_id", None)

    result = await db.execute(
        select(SectionVersion).where(
            SectionVersion.id == version_id,
            SectionVersion.section_id == section_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found for this section")

    restored = await restore_version(db, section_id, version_id, doc_id=section.document_id, api_key_id=api_key_id)

    if api_key_id:
        capture_event(str(current_user.id), str(section.document_id), "mcp_version_activated", {})

    return VersionRestoreResponse(success=True, active_version_id=restored.id)
