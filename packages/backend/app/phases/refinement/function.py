import uuid

import inngest
from loguru import logger

from app.database import async_session
from app.inngest_client import inngest_client
from app.phases._shared.concurrency import DOC_CONCURRENCY, SECTION_CONCURRENCY
from app.phases._shared.failure import workflow_on_failure
from app.phases.refinement.helpers import process_edit, process_question
from app.services import db as db_service


@inngest_client.create_function(
    fn_id="start-refinement",
    trigger=inngest.TriggerEvent(event="docforge/generation.completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def start_function(ctx: inngest.Context):
    """Set up refinement phase. Actions are handled by action_function."""
    step = ctx.step
    doc_id = ctx.event.data["document_id"]

    logger.info("[orchestrator] REFINEMENT start | doc_id={}", doc_id)

    async def _set_refinement():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "refinement")
            await db_service.start_refinement(db, doc_id)

    await step.run("set-phase-refinement", _set_refinement)


@inngest_client.create_function(
    fn_id="handle-section-action",
    trigger=inngest.TriggerEvent(event="docforge/user.section_action"),
    concurrency=SECTION_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def action_function(ctx: inngest.Context):
    """Process a single section action. Stateless — one invocation per user action.

    Concurrency design: SECTION_CONCURRENCY limits 1 active AI call per section.
    The lock is acquired at invocation start and released when the function returns.
    No step.wait_for_event is used here, so the lock is NEVER held across user think-time.
    Each new user action triggers a fresh invocation — no persistent loop, no stale locks.
    """
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    section_id = ctx.event.data["section_id"]
    action = ctx.event.data["action_type"]

    logger.info(
        "[orchestrator] section action | doc_id={} section_id={} action={}",
        doc_id,
        section_id,
        action,
    )

    if action == "request_edit":
        async def _apply_edit():
            await process_edit(section_id, ctx.event.data["prompt"])
        await step.run("apply-edit", _apply_edit)

    elif action == "ask_question":
        async def _answer_question():
            await process_question(section_id, ctx.event.data["message"])
        await step.run("answer-question", _answer_question)

    elif action == "finalize":
        async def _finalize():
            async with async_session() as db:
                await db_service.finalize_section(db, section_id, doc_id=uuid.UUID(doc_id))

        await step.run("finalize-section", _finalize)

        async def _check_finalized():
            async with async_session() as db:
                return await db_service.all_sections_finalized(db, doc_id)

        all_done = await step.run("check-all-finalized", _check_finalized)

        if all_done:
            logger.info(
                "[orchestrator] all sections finalized, triggering audit | doc_id={}",
                doc_id,
            )
            doc_type_id = ctx.event.data.get("document_type_id")
            await step.send_event(
                "emit-refinement-completed",
                inngest.Event(
                    name="docforge/document.refinement_completed",
                    data={"document_id": doc_id, "document_type_id": doc_type_id},
                ),
            )
