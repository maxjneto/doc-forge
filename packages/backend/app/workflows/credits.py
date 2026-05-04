"""Weekly credit reset for all users."""

import inngest
from loguru import logger
from sqlalchemy import update

from app.database import async_session
from app.inngest_client import inngest_client
from app.models.user import User


@inngest_client.create_function(
    fn_id="weekly-credit-reset",
    trigger=inngest.TriggerCron(cron="0 0 * * 1"),  # Every Monday at midnight UTC
)
async def weekly_credit_reset(ctx: inngest.Context):
    logger.info("[credits] weekly reset started")

    async with async_session() as db:
        result = await db.execute(update(User).values(credits=1))
        await db.commit()
        logger.info("[credits] weekly reset complete | rows_updated={}", result.rowcount)

    return {"status": "ok"}
