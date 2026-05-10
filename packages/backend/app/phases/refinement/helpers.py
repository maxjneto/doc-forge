import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.ai.core import clean_section_output
from app.database import async_session
from app.models import Section, ChatMessage
from app.services import db as db_service


async def _get_chat_history(db, section_id: uuid.UUID) -> list[dict]:
    """Fetch the last 20 chat messages for a section."""
    role_map = {
        "agent": "assistant",
        "assistant": "assistant",
        "user": "user",
    }

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.section_id == section_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "role": role_map.get(m.role, "user"),
            "content": m.content,
        }
        for m in messages[-20:]
    ]


async def _get_contract_dict(db, doc_id: uuid.UUID) -> dict | None:
    db_contract = await db_service.get_document_contract(db, doc_id)
    if not db_contract:
        return None
    return {
        "entities": db_contract.entities,
        "decisions": db_contract.decisions,
        "terminology": db_contract.terminology,
        "constraints": db_contract.constraints,
    }


def _build_cross_section_context(sections: list, target_type: str) -> str:
    deps = {
        "context": [],
        "proposal": ["context"],
        "implementation": ["proposal"],
        "risks": ["proposal", "implementation"],
    }

    needed = deps.get(target_type, [])
    parts = []

    for needed_type in needed:
        section = next((s for s in sections if s.section_type == needed_type), None)
        if section:
            active = next((v for v in section.versions if v.is_active), None)
            if active:
                parts.append(f"--- REFERENCE: {needed_type.upper()} ---\n{active.content}\n--- END ---")
            elif section.summary:
                parts.append(f"--- REFERENCE: {needed_type.upper()} (summary) ---\n{section.summary}\n--- END ---")

    return "\n\n".join(parts)


async def _build_cross_section_context_from_db(db, doc_id: uuid.UUID, target_type: str) -> str:
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.versions))
        .where(Section.document_id == doc_id)
    )
    sections = result.scalars().all()
    return _build_cross_section_context(sections, target_type)


async def process_edit(section_id: str, prompt: str) -> None:
    """Process an edit request via AI refinement."""
    from app.phases.refinement.ai import refine_section

    logger.info("[helpers] process_edit | section_id={}", section_id)
    async with async_session() as db:
        result = await db.execute(
            select(Section)
            .options(selectinload(Section.versions), selectinload(Section.document))
            .where(Section.id == uuid.UUID(section_id))
        )
        section = result.scalar_one()
        active_version = next((v for v in section.versions if v.is_active), None)
        if not active_version:
            return

        doc = section.document
        cross_context = _build_cross_section_context_from_db(db, doc.id, section.section_type)
        chat_history = await _get_chat_history(db, section.id)
        contract_dict = await _get_contract_dict(db, doc.id)

        await db_service.add_chat_message(db, doc.id, section.id, "user", prompt)

        from app.guardrails import validate_message_intent
        intent_err = await validate_message_intent(prompt, section.section_type, section.summary)
        if intent_err:
            await db_service.add_chat_message(db, doc.id, section.id, "agent", intent_err.message)
            return

        from openai import BadRequestError
        try:
            ai_result = await refine_section(
                section_type=section.section_type,
                general_context=doc.global_context or "",
                current_content=active_version.content,
                cross_section_context=await cross_context,
                chat_history=chat_history,
                user_message=prompt,
                forced_tool_name="request_edit",
                document_contract=contract_dict,
                db=db,
                document_type_id=doc.document_type_id,
            )
        except BadRequestError as exc:
            body = exc.body if isinstance(exc.body, dict) else {}
            if (body.get("error") or {}).get("code") == "content_filter":
                logger.warning("[helpers] content filter blocked refinement edit | section_id={}", section_id)
                await db_service.add_chat_message(
                    db, doc.id, section.id, "agent",
                    "Your request was blocked by the content policy. Please keep edit requests focused on the document.",
                )
                return
            raise

        if ai_result.get("tool") == "request_edit":
            logger.info(
                "[helpers] edit applied | section_id={} version_name='{}'",
                section_id,
                ai_result.get("version_name"),
            )
            cleaned_markdown = clean_section_output(ai_result.get("new_markdown"), section.section_type)
            await db_service.create_section_version(
                db,
                section.id,
                ai_result["version_name"],
                cleaned_markdown,
                parent_version_id=active_version.id,
                doc_id=doc.id,
            )
            await db_service.add_chat_message(
                db, doc.id, section.id, "agent",
                f"Done. Created version: {ai_result['version_name']}"
            )
        elif ai_result.get("tool") == "answer_question":
            await db_service.add_chat_message(db, doc.id, section.id, "agent", ai_result["reply"])


async def process_question(section_id: str, message: str) -> None:
    """Process a question about a section via AI."""
    from app.phases.refinement.ai import refine_section

    logger.info("[helpers] process_question | section_id={}", section_id)
    async with async_session() as db:
        result = await db.execute(
            select(Section)
            .options(selectinload(Section.versions), selectinload(Section.document))
            .where(Section.id == uuid.UUID(section_id))
        )
        section = result.scalar_one()
        active_version = next((v for v in section.versions if v.is_active), None)
        if not active_version:
            return

        doc = section.document
        cross_context = _build_cross_section_context_from_db(db, doc.id, section.section_type)
        chat_history = await _get_chat_history(db, section.id)
        contract_dict = await _get_contract_dict(db, doc.id)

        await db_service.add_chat_message(db, doc.id, section.id, "user", message)

        from app.guardrails import validate_message_intent
        intent_err = await validate_message_intent(message, section.section_type, section.summary)
        if intent_err:
            await db_service.add_chat_message(db, doc.id, section.id, "agent", intent_err.message)
            return

        from openai import BadRequestError
        try:
            ai_result = await refine_section(
                section_type=section.section_type,
                general_context=doc.global_context or "",
                current_content=active_version.content,
                cross_section_context=await cross_context,
                chat_history=chat_history,
                user_message=message,
                forced_tool_name="answer_question",
                document_contract=contract_dict,
                db=db,
                document_type_id=doc.document_type_id,
            )
        except BadRequestError as exc:
            body = exc.body if isinstance(exc.body, dict) else {}
            if (body.get("error") or {}).get("code") == "content_filter":
                logger.warning("[helpers] content filter blocked refinement question | section_id={}", section_id)
                await db_service.add_chat_message(
                    db, doc.id, section.id, "agent",
                    "Your request was blocked by the content policy. Please keep questions focused on the document.",
                )
                return
            raise

        if ai_result.get("tool") == "answer_question":
            await db_service.add_chat_message(db, doc.id, section.id, "agent", ai_result["reply"])
