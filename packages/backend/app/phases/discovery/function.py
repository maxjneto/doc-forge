import datetime
import uuid

import inngest
from loguru import logger
from sqlalchemy import or_, select

from app.database import async_session
from app.inngest_client import inngest_client
from app.models import DiscoveryQuestion, Section
from app.models.document_type import SectionDefinition
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

    async def _load_sections():
        async with async_session() as db:
            result = await db.execute(
                select(SectionDefinition)
                .where(SectionDefinition.document_type_id == uuid.UUID(document_type_id))
                .order_by(SectionDefinition.order)
            )
            defs = result.scalars().all()
            return [
                {"section_key": sd.section_key, "role_description": sd.role_description}
                for sd in defs
            ]

    section_defs = await step.run("load-section-definitions", _load_sections)

    for section_def in section_defs:
        section_key = section_def["section_key"]
        section_role = section_def["role_description"]

        logger.info(
            "[orchestrator] DISCOVERY section={} | doc_id={}", section_key, doc_id
        )

        async def _get_section_id(sk=section_key):
            async with async_session() as db:
                result = await db.execute(
                    select(Section).where(
                        Section.document_id == uuid.UUID(doc_id),
                        Section.section_type == sk,
                    )
                )
                section = result.scalar_one_or_none()
                return str(section.id) if section else None

        section_id_str = await step.run(f"get-section-id-{section_key}", _get_section_id)

        # Build the shared analyze closure; reads answered questions scoped to section_key.
        # Used for both the initial analysis and the post-answer finalization.
        def _make_analyze(sk, sr):
            async def _analyze():
                from app.phases.discovery.ai import analyze_discovery

                async with async_session() as db:
                    result = await db.execute(
                        select(DiscoveryQuestion)
                        .where(
                            DiscoveryQuestion.document_id == uuid.UUID(doc_id),
                            DiscoveryQuestion.section_key == sk,
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
                        section_key=sk,
                        section_role=sr,
                        db=db,
                        document_type_id=uuid.UUID(document_type_id) if document_type_id else None,
                    )
            return _analyze

        # Step 1: initial analysis — may immediately be sufficient or return questions.
        analysis = await step.run(
            f"analyze-context-{section_key}", _make_analyze(section_key, section_role)
        )

        if analysis["is_sufficient"]:
            context_to_save = analysis.get("consolidated_context") or document_context
            logger.info(
                "[orchestrator] section={} sufficient immediately | doc_id={}", section_key, doc_id
            )
        else:
            questions = analysis.get("follow_up_questions", [])[:2]

            if questions:
                logger.info(
                    "[orchestrator] saving {} questions for section={} | doc_id={}",
                    len(questions),
                    section_key,
                    doc_id,
                )

                async def _save_questions(qs=questions, sk=section_key):
                    async with async_session() as db:
                        for q in qs:
                            await db_service.save_discovery_question(db, doc_id, q, section_key=sk)

                await step.run(f"save-questions-{section_key}", _save_questions)

            # Poll-with-event loop: wait for the round_complete event OR re-check the DB
            # every 30s. Prevents the race where the user answers questions before
            # wait_for_event is created, causing the event to be missed permanently.
            def _make_check(sk):
                async def _check():
                    async with async_session() as db:
                        result = await db.execute(
                            select(DiscoveryQuestion).where(
                                DiscoveryQuestion.document_id == uuid.UUID(doc_id),
                                DiscoveryQuestion.section_key == sk,
                                DiscoveryQuestion.answer.is_(None),
                                DiscoveryQuestion.skipped.is_(False),
                            )
                        )
                        return result.scalars().first() is None
                return _check

            attempt = 0
            while True:
                done = await step.run(
                    f"check-answered-{section_key}-{attempt}", _make_check(section_key)
                )
                if done:
                    break
                await step.wait_for_event(
                    f"wait-round-complete-{section_key}-{attempt}",
                    event="docforge/user.discovery_round_complete",
                    timeout=datetime.timedelta(seconds=30),
                    if_exp="async.data.document_id == event.data.document_id",
                )
                attempt += 1
            logger.info(
                "[orchestrator] round complete section={} | doc_id={}", section_key, doc_id
            )

            # Step 3: finalize — re-analyze with answers now in DB to get consolidated_context.
            final_analysis = await step.run(
                f"finalize-context-{section_key}", _make_analyze(section_key, section_role)
            )
            context_to_save = final_analysis.get("consolidated_context") or document_context

        async def _save_context(sid=section_id_str, ctx_text=context_to_save):
            async with async_session() as db:
                await db_service.save_section_context(db, uuid.UUID(sid), ctx_text)

        await step.run(f"save-context-{section_key}", _save_context)

    logger.info("[orchestrator] emitting discovery.completed | doc_id={}", doc_id)
    await step.send_event(
        "emit-discovery-completed",
        inngest.Event(
            name="docforge/discovery.completed",
            data={"document_id": doc_id, "document_type_id": document_type_id},
        ),
    )
