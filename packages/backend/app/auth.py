"""JWT authentication via Clerk JWKS, with X-API-Key fallback."""

import hashlib
import time
from typing import Optional

import httpx
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)

# ─── JWKS cache ──────────────────────────────────────────────

_jwks_cache: Optional[dict] = None
_jwks_cache_at: float = 0.0
_JWKS_TTL = 3600  # 1 hour


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_at
    now = time.monotonic()
    if _jwks_cache is not None and (now - _jwks_cache_at) < _JWKS_TTL:
        return _jwks_cache

    if not settings.CLERK_JWKS_URL:
        logger.error("[auth] CLERK_JWKS_URL is not set")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLERK_JWKS_URL is not configured",
        )

    logger.debug("[auth] fetching JWKS from {}", settings.CLERK_JWKS_URL)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.CLERK_JWKS_URL, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_cache_at = now
            logger.debug("[auth] JWKS fetched | keys={}", len(_jwks_cache.get("keys", [])))
            return _jwks_cache
    except Exception as exc:
        logger.error("[auth] JWKS fetch failed: {}", exc)
        raise


# ─── Token validation ────────────────────────────────────────

async def _decode_token(token: str) -> dict:
    jwks = await _get_jwks()
    try:
        # Clerk does not include `aud` in session tokens by default, so
        # audience verification is disabled. Instead, we validate `azp`
        # (authorized party) below, which serves the same security purpose.
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        logger.warning("[auth] JWT decode failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate `azp` (authorized party) to ensure the token was issued by our
    # frontend and not by a different application sharing the same Clerk instance.
    azp: str | None = payload.get("azp")
    allowed = settings.CLERK_AUTHORIZED_PARTIES
    if azp and allowed and azp not in allowed:
        logger.warning("[auth] azp rejected | azp={} allowed={}", azp, allowed)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token authorized party not permitted",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.debug("[auth] JWT decoded | sub={} azp={} claims={}", payload.get("sub"), azp, list(payload.keys()))
    return payload


# ─── API key auth ────────────────────────────────────────────

async def _get_user_by_api_key(raw_key: str, db: AsyncSession) -> User | None:
    from app.models.api_key import ApiKey
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None))
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return None
    is_first_use = api_key.last_used_at is None
    await db.execute(
        update(ApiKey).where(ApiKey.id == api_key.id).values(last_used_at=func.now())
    )
    await db.commit()
    result = await db.execute(select(User).where(User.id == api_key.user_id))
    user = result.scalar_one_or_none()
    if is_first_use and user is not None:
        # Funnel step 1 (product-plan §9): the moment an agent's key is used
        # for the first time — fired once per key, not per request, to keep
        # PostHog volume sane.
        from app.services.observability import capture_account_event

        capture_account_event(user.id, "mcp_connected", {"harness": api_key.harness})
    return user


# ─── Dependency ──────────────────────────────────────────────

async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Optional["User"]:
    """Like get_current_user, but anonymous access yields None instead of 401.

    Used by endpoints that are public but enrich their response for
    authenticated callers (e.g. listing global + own custom document types).
    """
    if not x_api_key and credentials is None:
        request.state.api_key_id = None
        return None
    try:
        return await get_current_user(request, credentials, db, x_api_key)
    except HTTPException:
        request.state.api_key_id = None
        return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> User:
    logger.debug("[auth] get_current_user called")

    # API key path — takes priority when X-API-Key header is present
    if x_api_key:
        user = await _get_user_by_api_key(x_api_key, db)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key",
                headers={"WWW-Authenticate": "X-API-Key"},
            )
        request.state.api_key_id = None
        # Resolve the api_key_id for activity logging
        from app.models.api_key import ApiKey
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        result = await db.execute(
            select(ApiKey.id).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None))
        )
        api_key_id = result.scalar_one_or_none()
        request.state.api_key_id = api_key_id
        logger.debug("[auth] API key auth succeeded | user={} key_id={}", user.id, api_key_id)
        return user

    # JWT path
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    request.state.api_key_id = None
    payload = await _decode_token(credentials.credentials)

    user_id: str | None = payload.get("sub")
    email: str | None = payload.get("email")
    name: str | None = payload.get("name") or payload.get("full_name")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Email may not be in JWT if Clerk session template isn't configured yet
    if not email:
        email = f"{user_id}@clerk.local"

    # Atomic upsert — avoids race condition when concurrent requests create the same user
    stmt = (
        insert(User)
        .values(id=user_id, email=email, name=name or "", credits=settings.WEEKLY_CREDITS)
        .on_conflict_do_update(
            index_elements=["id"],
            set_={"email": email, "name": name or ""},
        )
    )
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    return user
