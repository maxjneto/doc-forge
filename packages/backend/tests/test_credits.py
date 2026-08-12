"""Credit periods must recover even when the external scheduler does not run."""

from datetime import datetime, timezone

import pytest

from app.config import settings
from app.models.user import User
from app.services.credits import (
    credit_period_start,
    next_credit_reset,
    refresh_credits_if_due,
)


def test_credit_period_is_monday_to_monday_utc():
    now = datetime(2026, 8, 13, 17, 45, tzinfo=timezone.utc)  # Thursday
    assert credit_period_start(now) == datetime(2026, 8, 10, tzinfo=timezone.utc)
    assert next_credit_reset(now) == datetime(2026, 8, 17, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_missing_period_repairs_existing_account(db_session):
    user = User(id="credit_repair", email="repair@test.com", credits=0)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    refreshed = await refresh_credits_if_due(
        db_session,
        user,
        now=datetime(2026, 8, 13, tzinfo=timezone.utc),
    )

    assert refreshed.credits == settings.WEEKLY_CREDITS
    assert refreshed.credits_reset_at.replace(tzinfo=timezone.utc) == datetime(
        2026, 8, 10, tzinfo=timezone.utc
    )


@pytest.mark.asyncio
async def test_balance_is_not_refilled_twice_in_same_week(db_session):
    user = User(
        id="credit_same_week",
        email="same@test.com",
        credits=1,
        credits_reset_at=datetime(2026, 8, 10, tzinfo=timezone.utc),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    refreshed = await refresh_credits_if_due(
        db_session,
        user,
        now=datetime(2026, 8, 16, 23, 59, tzinfo=timezone.utc),
    )

    assert refreshed.credits == 1


@pytest.mark.asyncio
async def test_expired_period_refills_on_access(db_session):
    user = User(
        id="credit_next_week",
        email="next@test.com",
        credits=0,
        credits_reset_at=datetime(2026, 8, 3, tzinfo=timezone.utc),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    refreshed = await refresh_credits_if_due(
        db_session,
        user,
        now=datetime(2026, 8, 10, 0, 1, tzinfo=timezone.utc),
    )

    assert refreshed.credits == settings.WEEKLY_CREDITS
