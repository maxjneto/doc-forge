import inngest
from loguru import logger

from app.database import async_session
from app.inngest_client import inngest_client
from app.phases._shared.concurrency import DOC_CONCURRENCY
from app.phases._shared.failure import workflow_on_failure
from app.services import db as db_service


@inngest_client.create_function(
    fn_id="complete-document",
    trigger=inngest.TriggerEvent(event="docforge/document.audit_completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def function(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]

    logger.info("[orchestrator] COMPLETED | doc_id={}", doc_id)

    async def _set_completed():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "completed")

    await step.run("set-phase-completed", _set_completed)
