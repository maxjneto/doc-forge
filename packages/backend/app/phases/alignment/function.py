import datetime
import uuid

import inngest
from loguru import logger

from app.database import async_session
from app.inngest_client import inngest_client
from app.phases._shared.concurrency import DOC_CONCURRENCY
from app.phases._shared.failure import workflow_on_failure
from app.services import db as db_service
from app.services.observability import capture_event, capture_span


@inngest_client.create_function(
    fn_id="run-alignment",
    trigger=inngest.TriggerEvent(event="docforge/discovery.completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def function(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")
    user_id = ctx.event.data.get("user_id", "")

    logger.info("[orchestrator] ALIGNMENT start | doc_id={}", doc_id)

    async def _set_alignment():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "alignment")

    await step.run("set-phase-alignment", _set_alignment)

    # Build section_contexts from per-section discovery_context values.
    # Falls back to global_context for documents created before migration 011.
    async def _build_section_contexts():
        async with async_session() as db:
            doc = await db_service.get_document_detail(db, doc_id)
            contexts: dict[str, str] = {}
            for section in doc.sections:
                if section.discovery_context:
                    contexts[section.section_type] = section.discovery_context

            if not contexts and doc.global_context:
                # Pre-redesign document: broadcast the single global context to all sections
                for section in doc.sections:
                    contexts[section.section_type] = doc.global_context

            return contexts

    section_contexts = await step.run("build-section-contexts", _build_section_contexts)

    all_approved = False
    iteration = 0

    while not all_approved:
        iteration += 1
        logger.info("[orchestrator] alignment iteration {} | doc_id={}", iteration, doc_id)

        async def _generate_summaries(sc=section_contexts):
            from app.phases.alignment.ai import generate_alignment
            async with async_session() as db:
                doc = await db_service.get_document_detail(db, doc_id)
                return await generate_alignment(
                    sc,
                    doc.user_preferences,
                    None,
                    db=db,
                    document_type_id=uuid.UUID(document_type_id) if document_type_id else None,
                    posthog_distinct_id=user_id,
                    doc_id=doc_id,
                )

        summaries = await step.run(f"generate-summaries-{iteration}", _generate_summaries)

        async def _save_summaries(s=summaries):
            async with async_session() as db:
                await db_service.save_summaries(db, doc_id, s["summaries"])

        await step.run(f"save-summaries-{iteration}", _save_summaries)

        approval_event = await step.wait_for_event(
            f"wait-alignment-approval-{iteration}",
            event="docforge/user.approved_alignment",
            timeout=datetime.timedelta(days=7),
            if_exp="event.data.document_id == async.data.document_id",
        )

        if approval_event.data.get("all_approved"):
            all_approved = True
            logger.info(
                "[orchestrator] alignment approved after {} iterations | doc_id={}",
                iteration,
                doc_id,
            )

            async def _extract_contract(s=summaries, sc=section_contexts):
                from app.phases.alignment.contract import extract_document_contract
                async with async_session() as db:
                    doc = await db_service.get_document_detail(db, doc_id)
                    # Provide the combined section contexts as grounding for the contract
                    combined_context = "\n\n".join(
                        f"## {k.capitalize()}\n{v}" for k, v in sc.items() if v
                    ) or doc.global_context or ""
                    contract = await extract_document_contract(
                        global_context=combined_context,
                        summaries=s.get("summaries", {}),
                        user_preferences=doc.user_preferences,
                        db=db,
                        document_type_id=uuid.UUID(document_type_id) if document_type_id else None,
                        posthog_distinct_id=user_id,
                        doc_id=doc_id,
                    )
                import json as _json
                raw = _json.dumps(contract)
                async with async_session() as db:
                    await db_service.save_document_contract(db, uuid.UUID(doc_id), contract, raw)

            await step.run("extract-contract", _extract_contract)
        else:
            rejected = approval_event.data.get("rejected", [])
            logger.info(
                "[orchestrator] alignment rejected sections={} | doc_id={}",
                rejected,
                doc_id,
            )

            async def _capture_rejected(r=rejected, it=iteration):
                for section_type in r:
                    capture_event(user_id, doc_id, "alignment_section_reopened", {"section_type": section_type, "iteration": it})

            await step.run(f"capture-alignment-rejected-{iteration}", _capture_rejected)

    async def _capture_phase_span():
        capture_span(
            user_id, doc_id,
            span_id=f"alignment-{doc_id}",
            span_name="alignment",
            input_state="Section contexts reviewed",
            output_state="Alignment approved",
        )

    await step.run("capture-span-alignment", _capture_phase_span)

    logger.info("[orchestrator] emitting alignment.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-alignment-completed",
        inngest.Event(
            name="docforge/alignment.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id, "user_id": user_id},
        ),
    )
