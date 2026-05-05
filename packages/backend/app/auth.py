"""JWT authentication via Clerk JWKS."""

import time
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer()

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


# ─── Dependency ──────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    logger.debug("[auth] get_current_user called")
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

    # Upsert user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(id=user_id, email=email, name=name, credits=1)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("[auth] new user created | user_id={}", user_id)
    else:
        # Sync name/email if changed
        if user.email != email or user.name != name:
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(email=email, name=name)
            )
            await db.commit()
            await db.refresh(user)

    return user
