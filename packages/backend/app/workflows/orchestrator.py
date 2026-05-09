import datetime
import uuid

import inngest
from loguru import logger
from sqlalchemy import or_, select

from app.inngest_client import inngest_client
from app.workflows.helpers import generate_section_root, process_edit, process_question
from app.workflows.credits import weekly_credit_reset
from app.database import async_session
from app.models import DiscoveryQuestion
from app.services import db as db_service


DOC_CONCURRENCY = [inngest.Concurrency(limit=1, key="event.data.document_id")]
SECTION_CONCURRENCY = [inngest.Concurrency(limit=1, key="event.data.section_id")]


def _extract_failed_document_id(event_data: dict) -> uuid.UUID | None:
    # on_failure receives a failure event payload that includes the original event in event.data.event.
    source_event = event_data.get("event")
    if not isinstance(source_event, dict):
        return None

    source_data = source_event.get("data")
    if not isinstance(source_data, dict):
        return None

    raw_doc_id = source_data.get("document_id")
    if not raw_doc_id:
        return None

    try:
        return uuid.UUID(str(raw_doc_id))
    except ValueError:
        return None


async def workflow_on_failure(ctx: inngest.Context) -> None:
    event_data = ctx.event.data if isinstance(ctx.event.data, dict) else {}
    doc_id = _extract_failed_document_id(event_data)
    if doc_id is None:
        logger.warning(
            "[orchestrator] on_failure missing document_id | run_id={} fn_failure_event={}",
            ctx.run_id,
            ctx.event.name,
        )
        return

    err = event_data.get("error") if isinstance(event_data.get("error"), dict) else {}
    error_name = err.get("name")
    error_message = err.get("message")
    if error_name and error_message:
        persisted_error = f"{error_name}: {error_message}"
    else:
        persisted_error = error_message or "Workflow execution failed"

    async with async_session() as db:
        await db_service.set_error_phase(db, doc_id, persisted_error)


# ── PHASE 1: DISCOVERY ──────────────────────────────────────────

@inngest_client.create_function(
    fn_id="run-discovery",
    trigger=inngest.TriggerEvent(event="docforge/document.started"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def run_discovery(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_context = ctx.event.data["document_context"]
    user_preferences = ctx.event.data["user_preferences"]
    document_type_id = ctx.event.data.get("document_type_id")

    logger.info("[orchestrator] DISCOVERY start | doc_id={}", doc_id)

    async def _set_discovery():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "discovery")
            await db_service.save_user_preferences(db, doc_id, user_preferences)

    await step.run("set-phase-discovery", _set_discovery)

    context_is_sufficient = False
    iteration = 0

    while not context_is_sufficient:
        iteration += 1
        logger.info("[orchestrator] discovery iteration {} | doc_id={}", iteration, doc_id)

        async def _analyze_context(i=iteration):
            from app.ai.discovery import analyze_discovery

            async with async_session() as db:
                result = await db.execute(
                    select(DiscoveryQuestion)
                    .where(
                        DiscoveryQuestion.document_id == uuid.UUID(doc_id),
                        or_(
                            DiscoveryQuestion.answer.is_not(None),
                            DiscoveryQuestion.skipped.is_(True),
                        ),
                    )
                    .order_by(DiscoveryQuestion.created_at)
                )
                answered_questions = result.scalars().all()

            follow_up_answers = [
                {"question": q.question, "answer": q.answer}
                for q in answered_questions
            ]

            return await analyze_discovery(
                document_context,
                user_preferences,
                follow_up_answers,
            )

        analysis = await step.run(f"analyze-context-{iteration}", _analyze_context)

        if analysis["is_sufficient"]:
            context_is_sufficient = True
            logger.info(
                "[orchestrator] context sufficient after {} iterations | doc_id={}",
                iteration,
                doc_id,
            )

            async def _save_context():
                async with async_session() as db:
                    await db_service.save_global_context(db, doc_id, analysis["consolidated_context"])

            await step.run("save-context", _save_context)
        else:
            questions = analysis.get("follow_up_questions", [])[:3]
            saved_ids: list[str] = []
            if questions:
                logger.info(
                    "[orchestrator] saving {} questions | doc_id={}",
                    len(questions),
                    doc_id,
                )

                async def _save_questions(qs=questions):
                    async with async_session() as db:
                        saved = []
                        for q in qs:
                            dq = await db_service.save_discovery_question(db, doc_id, q)
                            saved.append(str(dq.id))
                        return saved

                saved_ids = await step.run(f"save-questions-{iteration}", _save_questions)

            # Single wait per round — the answer router fires this event once
            # every pending question for the document is resolved, regardless
            # of how quickly the user answered them.
            await step.wait_for_event(
                f"wait-round-complete-{iteration}",
                event="docforge/user.discovery_round_complete",
                timeout=datetime.timedelta(days=7),
                if_exp="async.data.document_id == event.data.document_id",
            )
            logger.info(
                "[orchestrator] round {} complete | doc_id={}",
                iteration,
                doc_id,
            )

            # If every question in this round was skipped (no real answers), stop asking
            async def _check_all_skipped(ids=saved_ids):
                async with async_session() as db:
                    result = await db.execute(
                        select(DiscoveryQuestion).where(
                            DiscoveryQuestion.id.in_([uuid.UUID(i) for i in ids]),
                            DiscoveryQuestion.answer.is_not(None),
                        )
                    )
                    return result.scalars().first() is None

            all_skipped = await step.run(f"check-all-skipped-{iteration}", _check_all_skipped)
            if all_skipped:
                logger.info(
                    "[orchestrator] all questions skipped, forcing sufficiency | doc_id={}",
                    doc_id,
                )
                context_is_sufficient = True

                async def _save_context_forced():
                    async with async_session() as db:
                        await db_service.save_global_context(db, doc_id, document_context)

                await step.run("save-context", _save_context_forced)

    # Emit event to trigger alignment
    logger.info("[orchestrator] emitting discovery.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-discovery-completed",
        inngest.Event(
            name="docforge/discovery.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id},
        ),
    )


# ── PHASE 2: ALIGNMENT ──────────────────────────────────────────

@inngest_client.create_function(
    fn_id="run-alignment",
    trigger=inngest.TriggerEvent(event="docforge/discovery.completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def run_alignment(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")

    logger.info("[orchestrator] ALIGNMENT start | doc_id={}", doc_id)

    async def _set_alignment():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "alignment")

    await step.run("set-phase-alignment", _set_alignment)

    all_approved = False
    iteration = 0

    while not all_approved:
        iteration += 1
        logger.info("[orchestrator] alignment iteration {} | doc_id={}", iteration, doc_id)

        async def _generate_summaries():
            from app.ai.alignment import generate_alignment
            async with async_session() as db:
                doc = await db_service.get_document_detail(db, doc_id)
            return await generate_alignment(
                doc.global_context,
                doc.user_preferences,
                None,
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

            async def _extract_contract(s=summaries):
                from app.ai.contract import extract_document_contract
                async with async_session() as db:
                    doc = await db_service.get_document_detail(db, doc_id)
                contract = await extract_document_contract(
                    global_context=doc.global_context or "",
                    summaries=s.get("summaries", {}),
                    user_preferences=doc.user_preferences,
                )
                import json as _json
                raw = _json.dumps(contract)
                async with async_session() as db:
                    await db_service.save_document_contract(db, uuid.UUID(doc_id), contract, raw)

            await step.run("extract-contract", _extract_contract)
        else:
            logger.info(
                "[orchestrator] alignment rejected sections={} | doc_id={}",
                approval_event.data.get("rejected", []),
                doc_id,
            )

    # Emit event to trigger generation
    logger.info("[orchestrator] emitting alignment.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-alignment-completed",
        inngest.Event(
            name="docforge/alignment.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id},
        ),
    )


# ── PHASE 3: GENERATION (Parallel with Dependencies) ────────────

@inngest_client.create_function(
    fn_id="run-generation",
    trigger=inngest.TriggerEvent(event="docforge/alignment.completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def run_generation(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")

    logger.info("[orchestrator] GENERATION start | doc_id={}", doc_id)

    async def _set_generation():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "generation")

    await step.run("set-phase-generation", _set_generation)

    # Determine section order from SectionDefinition (falls back to RFC default)
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

    # Generate sections in order — first section has no cross-section deps,
    # each subsequent one can reference those already generated.
    for i, section_key in enumerate(section_order):
        async def _generate(sk=section_key):
            logger.info("[orchestrator] generating section {} | doc_id={}", sk, doc_id)
            await generate_section_root(doc_id, sk)
        await step.run(f"generate-{section_key}", _generate)

    # Cross-section coherence refinement pass
    async def _coherence_pass():
        from app.ai.generation import refine_cross_references
        await refine_cross_references(doc_id)

    await step.run("coherence-pass", _coherence_pass)

    # Emit event to trigger refinement
    logger.info("[orchestrator] emitting generation.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-generation-completed",
        inngest.Event(
            name="docforge/generation.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id},
        ),
    )


# ── PHASE 4: REFINEMENT (Stateless Action Handler) ──────────────

@inngest_client.create_function(
    fn_id="start-refinement",
    trigger=inngest.TriggerEvent(event="docforge/generation.completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def start_refinement_phase(ctx: inngest.Context):
    """Set up refinement phase. Actions are handled by handle_section_action."""
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")

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
async def handle_section_action(ctx: inngest.Context):
    """Process a single section action. Stateless — one invocation per user action.

    Concurrency design (M3-T13): SECTION_CONCURRENCY limits 1 active AI call per section.
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

        # Check if all sections are finalized
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


# ── PHASE 5: AUDIT ──────────────────────────────────────────────

@inngest_client.create_function(
    fn_id="run-audit",
    trigger=inngest.TriggerEvent(event="docforge/document.refinement_completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def run_audit_fn(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")

    logger.info("[orchestrator] AUDIT start | doc_id={}", doc_id)

    async def _set_audit():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "audit")

    await step.run("set-phase-audit", _set_audit)

    async def _run_audit():
        from app.ai.audit import run_audit
        return await run_audit(doc_id)

    result = await step.run("run-audit", _run_audit)

    async def _save_findings(r=result):
        findings = [
            {
                "section_type": p["section"],
                "description": p["issue"],
                "severity": p["severity"],
            }
            for p in r.get("problems", [])
        ]
        if findings:
            async with async_session() as db:
                await db_service.save_audit_findings(db, uuid.UUID(doc_id), findings)
        logger.info(
            "[orchestrator] audit findings saved | doc_id={} count={}",
            doc_id,
            len(findings),
        )

    await step.run("save-findings", _save_findings)

    await step.send_event(
        "emit-audit-completed",
        inngest.Event(
            name="docforge/document.audit_completed",
            data={"document_id": doc_id, "document_type_id": document_type_id},
        ),
    )


# ── COMPLETION ──────────────────────────────────────────────────

@inngest_client.create_function(
    fn_id="complete-document",
    trigger=inngest.TriggerEvent(event="docforge/document.audit_completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def complete_document(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]

    logger.info("[orchestrator] COMPLETED | doc_id={}", doc_id)

    async def _set_completed():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "completed")

    await step.run("set-phase-completed", _set_completed)


# ── Export all functions for Inngest serve ───────────────────────

ALL_FUNCTIONS = [
    run_discovery,
    run_alignment,
    run_generation,
    start_refinement_phase,
    handle_section_action,
    run_audit_fn,
    complete_document,
    weekly_credit_reset,
]
