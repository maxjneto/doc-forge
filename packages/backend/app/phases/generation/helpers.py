import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.ai.core import clean_section_output
from app.database import async_session
from app.models import Section
from app.services import db as db_service


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
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.versions))
        .where(Section.document_id == doc_id)
    )
    sections = result.scalars().all()
    return _build_cross_section_context(sections, target_type)


async def generate_section_root(doc_id: str, section_type: str) -> None:
    """Generate the initial version of a section using AI."""
    from app.phases.generation.ai import generate_section

    logger.info("[helpers] generate_section_root | doc_id={} type={}", doc_id, section_type)
    async with async_session() as db:
        doc = await db_service.get_document_detail(db, uuid.UUID(doc_id))
        section = next((s for s in doc.sections if s.section_type == section_type), None)
        if not section:
            return

        cross_section_context = _build_cross_section_context(doc.sections, section_type)

        db_contract = await db_service.get_document_contract(db, uuid.UUID(doc_id))
        contract_dict = None
        if db_contract:
            contract_dict = {
                "entities": db_contract.entities,
                "decisions": db_contract.decisions,
                "terminology": db_contract.terminology,
                "constraints": db_contract.constraints,
            }

        content = await generate_section(
            section_type=section_type,
            general_context=doc.global_context or "",
            user_preferences=doc.user_preferences or "",
            section_summary=section.summary or "",
            cross_section_context=cross_section_context,
            document_contract=contract_dict,
            db=db,
            document_type_id=doc.document_type_id,
        )
        content = clean_section_output(content, section_type)

        await db_service.create_section_version(
            db, section.id, "Initial", content, doc_id=uuid.UUID(doc_id)
        )

        section.status = "drafting"
        await db.commit()
        logger.info(
            "[helpers] section version created | doc_id={} type={} chars={}",
            doc_id,
            section_type,
            len(content or ""),
        )
