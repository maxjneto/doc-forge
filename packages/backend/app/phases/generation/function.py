import uuid

import inngest
from loguru import logger

from app.database import async_session
from app.inngest_client import inngest_client
from app.phases._shared.concurrency import DOC_CONCURRENCY
from app.phases._shared.failure import workflow_on_failure
from app.phases.generation.helpers import generate_section_root
from app.services import db as db_service
from app.services.observability import capture_span


@inngest_client.create_function(
    fn_id="run-generation",
    trigger=inngest.TriggerEvent(event="docforge/alignment.completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def function(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")
    user_id = ctx.event.data.get("user_id", "")

    logger.info("[orchestrator] GENERATION start | doc_id={}", doc_id)

    async def _set_generation():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "generation")

    await step.run("set-phase-generation", _set_generation)

    async def _get_section_order():
        if not document_type_id:
            return ["context", "proposal", "implementation", "risks"]
        from sqlalchemy import select as _select

        from app.models.document_type import SectionDefinition
        async with async_session() as db:
            result = await db.execute(
                _select(SectionDefinition)
                .where(SectionDefinition.document_type_id == uuid.UUID(document_type_id))
                .order_by(SectionDefinition.order)
            )
            defs = result.scalars().all()
        return [sd.section_key for sd in defs] if defs else ["context", "proposal", "implementation", "risks"]

    section_order = await step.run("get-section-order", _get_section_order)

    for section_key in section_order:
        async def _generate(sk=section_key):
            logger.info("[orchestrator] generating section {} | doc_id={}", sk, doc_id)
            content = await generate_section_root(doc_id, sk, posthog_distinct_id=user_id)
            capture_span(
                user_id, doc_id,
                span_id=f"generation-{sk}-{doc_id}",
                span_name=sk,
                parent_id=f"generation-{doc_id}",
                input_state=f"Generate section: {sk}",
                output_state=content[:1000] if content else "",
            )
        await step.run(f"generate-{section_key}", _generate)

    async def _coherence_pass():
        from app.phases.generation.ai import refine_cross_references
        await refine_cross_references(doc_id, document_type_id=document_type_id, posthog_distinct_id=user_id)

    await step.run("coherence-pass", _coherence_pass)

    async def _capture_phase_span():
        capture_span(
            user_id, doc_id,
            span_id=f"generation-{doc_id}",
            span_name="generation",
            input_state="Sections generated",
            output_state="Generation complete",
        )

    await step.run("capture-span-generation", _capture_phase_span)

    logger.info("[orchestrator] emitting generation.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-generation-completed",
        inngest.Event(
            name="docforge/generation.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id, "user_id": user_id},
        ),
    )
