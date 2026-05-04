import uuid

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Section, SectionVersion, ChatMessage
from app.schemas.section import SectionVersionResponse, ChatMessageResponse, VersionRestoreResponse
from app.services.db import restore_version

router = APIRouter(tags=["sections"])


@router.get("/sections/{section_id}/versions", response_model=list[SectionVersionResponse])
async def get_section_versions(section_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    logger.debug("[router] get_section_versions | section_id={}", section_id)
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id)
        .order_by(SectionVersion.created_at)
    )
    versions = result.scalars().all()
    return [SectionVersionResponse.model_validate(v) for v in versions]


@router.get("/sections/{section_id}/chat", response_model=list[ChatMessageResponse])
async def get_section_chat(section_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
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
):
    logger.info(
        "[router] restore_version | section_id={} version_id={}",
        section_id,
        version_id,
    )
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
