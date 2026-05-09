import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models import Section, ChatMessage
from app.services import db as db_service
from app.ai.output_cleaner import strip_outer_markdown_fence


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
    # Return last 20 messages formatted for the AI
    return [
        {
            "role": role_map.get(m.role, "user"),
            "content": m.content,
        }
        for m in messages[-20:]
    ]


async def generate_section_root(doc_id: str, section_type: str) -> None:
    """Generate the initial version of a section using AI."""
    from app.ai.generation import generate_section

    logger.info("[helpers] generate_section_root | doc_id={} type={}", doc_id, section_type)
    async with async_session() as db:
        doc = await db_service.get_document_detail(db, uuid.UUID(doc_id))
        section = next((s for s in doc.sections if s.section_type == section_type), None)
        if not section:
            return

        # Build cross-section context
        cross_section_context = _build_cross_section_context(doc.sections, section_type)

        content = await generate_section(
            section_type=section_type,
            general_context=doc.global_context or "",
            user_preferences=doc.user_preferences or "",
            section_summary=section.summary or "",
            cross_section_context=cross_section_context,
        )

        # Create first version
        await db_service.create_section_version(
            db, section.id, "Initial", content, doc_id=uuid.UUID(doc_id)
        )

        # Update section status
        section.status = "drafting"
        await db.commit()
        logger.info(
            "[helpers] section version created | doc_id={} type={} chars={}",
            doc_id,
            section_type,
            len(content or ""),
        )


async def process_edit(section_id: str, prompt: str) -> None:
    """Process an edit request via AI refinement."""
    from app.ai.refinement import refine_section

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

        # Persist user message before AI call so created_at ordering is correct
        await db_service.add_chat_message(db, doc.id, section.id, "user", prompt)

        ai_result = await refine_section(
            section_type=section.section_type,
            general_context=doc.global_context or "",
            current_content=active_version.content,
            cross_section_context=await cross_context,
            chat_history=chat_history,
            user_message=prompt,
            forced_tool_name="request_edit",
        )

        if ai_result.get("tool") == "request_edit":
            logger.info(
                "[helpers] edit applied | section_id={} version_name='{}'",
                section_id,
                ai_result.get("version_name"),
            )
            cleaned_markdown = strip_outer_markdown_fence(ai_result.get("new_markdown"))
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
    from app.ai.refinement import refine_section

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

        # Save user message before AI call so created_at ordering is correct
        await db_service.add_chat_message(db, doc.id, section.id, "user", message)

        ai_result = await refine_section(
            section_type=section.section_type,
            general_context=doc.global_context or "",
            current_content=active_version.content,
            cross_section_context=await cross_context,
            chat_history=chat_history,
            user_message=message,
            forced_tool_name="answer_question",
        )

        if ai_result.get("tool") == "answer_question":
            await db_service.add_chat_message(db, doc.id, section.id, "agent", ai_result["reply"])


def _build_cross_section_context(sections: list, target_type: str) -> str:
    """Build cross-section context based on dependencies."""
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
    """Build cross-section context from database."""
    from app.models import Section
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.versions))
        .where(Section.document_id == doc_id)
    )
    sections = result.scalars().all()
    return _build_cross_section_context(sections, target_type)
