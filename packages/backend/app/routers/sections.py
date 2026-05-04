import uuid

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Section, SectionVersion, ChatMessage, Document
from app.models.user import User
from app.schemas.section import SectionVersionResponse, ChatMessageResponse, VersionRestoreResponse
from app.services.db import restore_version

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


@router.post("/sections/{section_id}/versions/{version_id}/restore", response_model=VersionRestoreResponse)
async def restore_section_version(
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
    await _assert_section_ownership(section_id, current_user, db)

    # Verify version belongs to section
    result = await db.execute(
        select(SectionVersion).where(
            SectionVersion.id == version_id,
            SectionVersion.section_id == section_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found for this section")

    restored = await restore_version(db, section_id, version_id)
    return VersionRestoreResponse(success=True, active_version_id=restored.id)
