import datetime
import uuid

import inngest
from loguru import logger
from sqlalchemy import or_, select

from app.database import async_session
from app.inngest_client import inngest_client
from app.models import DiscoveryQuestion
from app.phases._shared.concurrency import DOC_CONCURRENCY
from app.phases._shared.failure import workflow_on_failure
from app.services import db as db_service


@inngest_client.create_function(
    fn_id="run-discovery",
    trigger=inngest.TriggerEvent(event="docforge/document.started"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def function(ctx: inngest.Context):
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
            from app.phases.discovery.ai import analyze_discovery

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
                    db=db,
                    document_type_id=uuid.UUID(document_type_id) if document_type_id else None,
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

    logger.info("[orchestrator] emitting discovery.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-discovery-completed",
        inngest.Event(
            name="docforge/discovery.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id},
        ),
    )
