import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.api_key import ApiKey
from app.models.document import Document
from app.models.document_activity import DocumentActivity
from app.models.user import User
from app.schemas.api_key import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListItem,
    ApiKeyUpdateRequest,
)
from app.services import tiers as tiers_service

router = APIRouter(tags=["users"])


@router.get("/tiers")
async def list_tiers():
    """Public single source of truth for plan tiers (pricing/billing pages + limits)."""
    return {"tiers": tiers_service.get_tiers()}


@router.get("/users/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "credits": current_user.credits,
        "weekly_credits": settings.WEEKLY_CREDITS,
        "plan": current_user.plan,
    }


@router.post("/users/api-keys", response_model=ApiKeyCreateResponse, status_code=201)
async def create_api_key(
    payload: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit_error = await tiers_service.check_api_key_limit(db, current_user)
    if limit_error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=limit_error)
    raw_key = secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key = ApiKey(
        id=uuid.uuid4(),
        user_id=current_user.id,
        key_hash=key_hash,
        name=payload.name,
        harness=payload.harness,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return ApiKeyCreateResponse(
        id=api_key.id,
        name=api_key.name,
        harness=api_key.harness,
        key=raw_key,
        created_at=api_key.created_at,
    )


@router.get("/users/api-keys", response_model=list[ApiKeyListItem])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/users/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if api_key.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Key already revoked")
    api_key.revoked_at = datetime.now(timezone.utc)
    await db.commit()


@router.patch("/users/api-keys/{key_id}", response_model=ApiKeyListItem)
async def update_api_key(
    key_id: uuid.UUID,
    payload: ApiKeyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if api_key.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Key already revoked")
    api_key.harness = payload.harness
    await db.commit()
    await db.refresh(api_key)
    return api_key


@router.get("/users/me/activity")
async def get_my_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Cross-document activity feed for the dashboard sidebar.

    Returns the most recent DocumentActivity rows for documents owned by the
    current user, joined with the originating ApiKey name (NULL = user).
    """
    rows = await db.execute(
        select(DocumentActivity, ApiKey.name, ApiKey.harness, Document.id, Document.title)
        .join(Document, DocumentActivity.document_id == Document.id)
        .outerjoin(ApiKey, DocumentActivity.api_key_id == ApiKey.id)
        .where(Document.user_id == current_user.id)
        .order_by(DocumentActivity.created_at.desc())
        .limit(limit)
    )
    events = []
    for activity, key_name, key_harness, doc_id, doc_title in rows:
        events.append({
            "id": str(activity.id),
            "action_type": activity.action_type,
            "description": activity.description,
            "actor_name": key_name if key_name else "You",
            "is_agent": key_name is not None,
            "harness": key_harness,
            "bytes_delta": activity.bytes_delta,
            "version_id": str(activity.version_id) if activity.version_id else None,
            "doc_id": str(doc_id),
            "doc_title": doc_title,
            "created_at": activity.created_at.isoformat() if activity.created_at else None,
        })
    return {"events": events}
