"""Weekly credit reset for all users."""

import inngest
from loguru import logger
from sqlalchemy import select

from app.database import async_session
from app.inngest_client import inngest_client
from app.models.user import User
from app.services.credits import credit_period_start, weekly_document_allowance


@inngest_client.create_function(
    fn_id="weekly-credit-reset",
    trigger=inngest.TriggerCron(cron="0 0 * * 1"),  # Every Monday at midnight UTC
)
async def weekly_credit_reset(ctx: inngest.Context):
    logger.info("[credits] weekly document reset started")

    async with async_session() as db:
        users = (await db.execute(select(User))).scalars().all()
        for user in users:
            user.credits = weekly_document_allowance(user.plan)
            user.credits_reset_at = credit_period_start()
        await db.commit()
        logger.info("[credits] weekly reset complete | rows_updated={}", len(users))

    return {"status": "ok"}
