"""Credit periods and self-healing weekly allowance refreshes.

There is no scheduler: every authenticated request refreshes an expired
allowance atomically, so an account never stays at zero past Monday.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


def credit_period_start(now: datetime | None = None) -> datetime:
    """Return Monday 00:00 UTC for the week containing *now*."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    else:
        current = current.astimezone(timezone.utc)
    return (current - timedelta(days=current.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def next_credit_reset(now: datetime | None = None) -> datetime:
    return credit_period_start(now) + timedelta(days=7)


def weekly_document_allowance(plan: str) -> int:
    """Return the number of new documents an account may create per week."""
    return (
        settings.PRO_WEEKLY_DOCUMENT_CREDITS
        if plan and plan != "free"
        else settings.FREE_WEEKLY_DOCUMENT_CREDITS
    )


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def refresh_credits_if_due(
    db: AsyncSession,
    user: User,
    *,
    now: datetime | None = None,
) -> User:
    """Refresh *user* once per UTC week and return current database state.

    The conditional UPDATE makes concurrent browser/MCP requests idempotent.
    A NULL period is intentionally considered expired so the migration repairs
    existing production accounts on their first request after deploy.
    """
    period_start = credit_period_start(now)
    if (_as_utc(user.credits_reset_at) or datetime.min.replace(tzinfo=timezone.utc)) >= period_start:
        return user

    await db.execute(
        update(User)
        .where(
            User.id == user.id,
            or_(User.credits_reset_at.is_(None), User.credits_reset_at < period_start),
        )
        .values(
            credits=weekly_document_allowance(user.plan),
            credits_reset_at=period_start,
        )
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    result = await db.execute(
        select(User).where(User.id == user.id).execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def consume_document_creation(db: AsyncSession, user: User) -> User:
    """Atomically consume one weekly document-creation allowance.

    The historical ``users.credits`` column now represents document creations.
    Keeping the decrement in one service prevents the editor, layout and MCP
    routes from drifting apart.
    """
    user = await refresh_credits_if_due(db, user)
    result = await db.execute(
        update(User)
        .where(User.id == user.id, User.credits >= 1)
        .values(credits=User.credits - 1)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "WEEKLY_DOCUMENT_LIMIT_REACHED",
                "message": "No document creations remain this week.",
                "reset_at": next_credit_reset().isoformat(),
            },
        )
    await db.commit()
    result = await db.execute(
        select(User).where(User.id == user.id).execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def refund_document_creation(db: AsyncSession, user_id: str) -> None:
    """Return a creation allowance when persistence fails before a document exists."""
    await db.execute(
        update(User).where(User.id == user_id).values(credits=User.credits + 1)
    )
    await db.commit()
