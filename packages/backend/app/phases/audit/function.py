import uuid

import inngest
from loguru import logger

from app.database import async_session
from app.inngest_client import inngest_client
from app.phases._shared.concurrency import DOC_CONCURRENCY
from app.phases._shared.failure import workflow_on_failure
from app.services import db as db_service


@inngest_client.create_function(
    fn_id="run-audit",
    trigger=inngest.TriggerEvent(event="docforge/document.refinement_completed"),
    concurrency=DOC_CONCURRENCY,
    on_failure=workflow_on_failure,
)
async def function(ctx: inngest.Context):
    step = ctx.step
    doc_id = ctx.event.data["document_id"]
    document_type_id = ctx.event.data.get("document_type_id")

    logger.info("[orchestrator] AUDIT start | doc_id={}", doc_id)

    async def _set_audit():
        async with async_session() as db:
            await db_service.set_phase(db, doc_id, "audit")

    await step.run("set-phase-audit", _set_audit)

    async def _run_audit():
        from app.phases.audit.ai import run_audit
        return await run_audit(doc_id, document_type_id=document_type_id)

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
