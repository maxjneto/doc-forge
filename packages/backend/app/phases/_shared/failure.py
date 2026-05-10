"""Shared workflow failure handler — persists error phase to DB on Inngest failure."""
import uuid

import inngest
from loguru import logger

from app.database import async_session
from app.services import db as db_service


def _extract_failed_document_id(event_data: dict) -> uuid.UUID | None:
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
            "[on_failure] missing document_id | run_id={} event={}",
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
