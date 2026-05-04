import datetime
import uuid

import inngest
from loguru import logger
from sqlalchemy import or_, select

from app.inngest_client import inngest_client
from app.workflows.helpers import generate_section_root, process_edit, process_question, process_analysis
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
            if questions:
                logger.info(
                    "[orchestrator] saving {} questions | doc_id={}",
                    len(questions),
                    doc_id,
                )

                async def _save_questions(qs=questions):
                    async with async_session() as db:
                        for q in qs:
                            await db_service.save_discovery_question(db, doc_id, q)

                await step.run(f"save-questions-{iteration}", _save_questions)

            # Wait for one answer per question in this round
            round_answers: list[dict] = []
            for q_idx, question in enumerate(questions):
                answer_event = await step.wait_for_event(
                    f"wait-user-answer-{iteration}-{q_idx}",
                    event="docforge/user.answered_question",
                    timeout=datetime.timedelta(days=7),
                    if_exp="event.data.document_id == async.data.document_id",
                )
                logger.info(
                    "[orchestrator] user answered | doc_id={} iteration={} q_idx={}",
                    doc_id, iteration, q_idx,
                )
                round_answers.append({
                    "question": answer_event.data["question"],
                    "answer": answer_event.data.get("answer"),
                })

            # If all questions in this round were skipped, stop asking
            all_skipped = all(a["answer"] is None for a in round_answers)
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
            data={"document_id": doc_id},
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
            data={"document_id": doc_id},
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

    logger.info("[orchestrator] GENERATION start | doc_id={}", doc_id)

    async def _set_generation():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "generation")

    await step.run("set-phase-generation", _set_generation)

    # Step 1: Generate 'context' first (no dependencies)
    async def _generate_context():
        logger.info("[orchestrator] generating section context | doc_id={}", doc_id)
        await generate_section_root(doc_id, "context")

    await step.run("generate-context", _generate_context)

    # Step 2: Generate proposal, implementation, and risks in isolated steps
    async def _generate_proposal():
        logger.info("[orchestrator] generating section proposal | doc_id={}", doc_id)
        await generate_section_root(doc_id, "proposal")

    async def _generate_implementation():
        logger.info("[orchestrator] generating section implementation | doc_id={}", doc_id)
        await generate_section_root(doc_id, "implementation")

    async def _generate_risks():
        logger.info("[orchestrator] generating section risks | doc_id={}", doc_id)
        await generate_section_root(doc_id, "risks")

    await step.run("generate-proposal", _generate_proposal)
    await step.run("generate-implementation", _generate_implementation)
    await step.run("generate-risks", _generate_risks)

    # Step 3: Cross-section coherence refinement pass
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
            data={"document_id": doc_id},
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
    """Process a single section action. Stateless — one invocation per user action."""
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

    elif action == "analyze_user_edit":
        async def _analyze_edit():
            await process_analysis(section_id, ctx.event.data["user_text"])
        await step.run("analyze-edit", _analyze_edit)

    elif action == "ask_question":
        async def _answer_question():
            await process_question(section_id, ctx.event.data["message"])
        await step.run("answer-question", _answer_question)

    elif action == "finalize":
        async def _finalize():
            async with async_session() as db:
                await db_service.finalize_section(db, section_id)

        await step.run("finalize-section", _finalize)

        # Check if all sections are finalized
        async def _check_finalized():
            async with async_session() as db:
                return await db_service.all_sections_finalized(db, doc_id)

        all_done = await step.run("check-all-finalized", _check_finalized)

        if all_done:
            logger.info(
                "[orchestrator] all sections finalized, bypassing audit and emitting audit.passed | doc_id={}",
                doc_id,
            )
            await step.send_event(
                "emit-audit-passed-bypass",
                inngest.Event(
                    name="docforge/audit.passed",
                    data={"document_id": doc_id},
                ),
            )


# ── PHASE 5: AUDIT ──────────────────────────────────────────────

@inngest_client.create_function(
    fn_id="run-audit",
    trigger=inngest.TriggerEvent(event="docforge/refinement.all_finalized"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def run_audit_fn(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]

    logger.info("[orchestrator] AUDIT start | doc_id={}", doc_id)

    async def _set_audit():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "audit")

    await step.run("set-phase-audit", _set_audit)

    async def _run_audit():
        from app.ai.audit import run_audit
        return await run_audit(doc_id)

    result = await step.run("run-audit", _run_audit)

    if not result["has_problems"]:
        logger.info("[orchestrator] audit PASSED | doc_id={}", doc_id)
        async def _clear_problems():
            async with async_session() as db:
                await db_service.clear_audit_problems(db, doc_id)

        await step.run("clear-audit-problems", _clear_problems)

        # Emit audit passed
        await step.send_event(
            "emit-audit-passed",
            inngest.Event(
                name="docforge/audit.passed",
                data={"document_id": doc_id},
            ),
        )
    else:
        affected = [p["section"] for p in result["problems"]]
        logger.warning(
            "[orchestrator] audit FAILED | doc_id={} problem_count={} affected_sections={}",
            doc_id,
            len(result["problems"]),
            affected,
        )

        async def _reopen():
            async with async_session() as db:
                await db_service.save_audit_problems(db, doc_id, result["problems"])
                await db_service.reopen_sections(db, doc_id, affected)
                await db_service.set_phase(db, doc_id, "refinement")

        await step.run("reopen-sections", _reopen)
        # Sections are now in 'refining' state — handle_section_action will
        # process user actions. When all finalized again, refinement.all_finalized
        # triggers run_audit_fn again for re-audit.


# ── COMPLETION ──────────────────────────────────────────────────

@inngest_client.create_function(
    fn_id="complete-document",
    trigger=inngest.TriggerEvent(event="docforge/audit.passed"),
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
