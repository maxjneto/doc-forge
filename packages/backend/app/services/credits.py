"""Credit periods and self-healing weekly allowance refreshes.

The Inngest cron remains useful as an eager batch refresh, but correctness does
not depend on it: every authenticated request refreshes an expired allowance
atomically. This prevents users from remaining at zero when the scheduler is
unavailable or misconfigured in production.
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


def weekly_allowance(plan: str) -> int:
    """Current allowance source.

    Paid-plan allocation is not yet separately configured, so every existing
    account receives the configured weekly allowance. Keeping this in one
    function makes a future per-plan allocation explicit instead of silently
    treating ``None`` as no refill.
    """
    del plan
    return settings.WEEKLY_CREDITS


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
            credits=weekly_allowance(user.plan),
            credits_reset_at=period_start,
        )
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    result = await db.execute(
        select(User).where(User.id == user.id).execution_options(populate_existing=True)
    )
    return result.scalar_one()
