import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Document, Section, SectionVersion, ChatMessage, DiscoveryQuestion


async def set_phase(db: AsyncSession, doc_id: uuid.UUID, phase: str) -> None:
    await db.execute(
        update(Document).where(Document.id == doc_id).values(current_phase=phase)
    )
    await db.commit()


async def set_error_phase(
    db: AsyncSession,
    doc_id: uuid.UUID,
    error_message: str | None,
) -> None:
    await db.execute(
        update(Document)
        .where(Document.id == doc_id)
        .values(current_phase="error", error_message=error_message)
    )
    await db.commit()


async def save_global_context(db: AsyncSession, doc_id: uuid.UUID, context: str) -> None:
    await db.execute(
        update(Document).where(Document.id == doc_id).values(global_context=context)
    )
    await db.commit()


async def save_user_preferences(db: AsyncSession, doc_id: uuid.UUID, preferences: str) -> None:
    await db.execute(
        update(Document).where(Document.id == doc_id).values(user_preferences=preferences)
    )
    await db.commit()


async def save_summaries(db: AsyncSession, doc_id: uuid.UUID, summaries: dict[str, str]) -> None:
    """Save section summaries. summaries = {section_type: summary_text}"""
    for section_type, summary in summaries.items():
        # Ensure section exists
        result = await db.execute(
            select(Section).where(
                Section.document_id == doc_id,
                Section.section_type == section_type,
            )
        )
        section = result.scalar_one_or_none()
        if section:
            section.summary = summary
        else:
            section = Section(
                document_id=doc_id,
                section_type=section_type,
                summary=summary,
            )
            db.add(section)
    await db.commit()


async def save_discovery_question(db: AsyncSession, doc_id: uuid.UUID, question: str) -> DiscoveryQuestion:
    q = DiscoveryQuestion(document_id=doc_id, question=question)
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return q


async def finalize_section(db: AsyncSession, section_id: uuid.UUID) -> None:
    await db.execute(
        update(Section).where(Section.id == section_id).values(status="finalized")
    )
    await db.commit()


async def start_refinement(db: AsyncSession, doc_id: uuid.UUID) -> None:
    """Transition all drafting sections to refining status when Phase 4 starts."""
    await db.execute(
        update(Section)
        .where(Section.document_id == doc_id, Section.status == "drafting")
        .values(status="refining")
    )
    await db.commit()


async def all_sections_finalized(db: AsyncSession, doc_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Section).where(
            Section.document_id == doc_id,
            Section.status != "finalized",
        )
    )
    return result.first() is None


async def reopen_sections(db: AsyncSession, doc_id: uuid.UUID, section_types: list[str]) -> None:
    await db.execute(
        update(Section)
        .where(Section.document_id == doc_id, Section.section_type.in_(section_types))
        .values(status="refining")
    )
    await db.commit()


async def save_audit_problems(db: AsyncSession, doc_id: uuid.UUID, problems: list[dict]) -> None:
    """Store audit problems on the document for frontend display."""
    await db.execute(
        update(Document).where(Document.id == doc_id).values(audit_problems=problems)
    )
    await db.commit()


async def clear_audit_problems(db: AsyncSession, doc_id: uuid.UUID) -> None:
    """Clear audit problems when audit passes."""
    await db.execute(
        update(Document).where(Document.id == doc_id).values(audit_problems=None)
    )
    await db.commit()


async def add_chat_message(
    db: AsyncSession,
    document_id: uuid.UUID,
    section_id: uuid.UUID,
    role: str,
    content: str,
) -> ChatMessage:
    msg = ChatMessage(
        document_id=document_id,
        section_id=section_id,
        role=role,
        content=content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def create_section_version(
    db: AsyncSession,
    section_id: uuid.UUID,
    version_name: str,
    content: str,
    parent_version_id: uuid.UUID | None = None,
) -> SectionVersion:
    # Deactivate current active version
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active == True)
        .values(is_active=False)
    )
    # Create new active version
    version = SectionVersion(
        section_id=section_id,
        parent_version_id=parent_version_id,
        version_name=version_name,
        content=content,
        is_active=True,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


async def restore_version(db: AsyncSession, section_id: uuid.UUID, version_id: uuid.UUID) -> SectionVersion:
    # Deactivate current active
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.section_id == section_id, SectionVersion.is_active == True)
        .values(is_active=False)
    )
    # Activate target version
    await db.execute(
        update(SectionVersion)
        .where(SectionVersion.id == version_id)
        .values(is_active=True)
    )
    await db.commit()
    result = await db.execute(select(SectionVersion).where(SectionVersion.id == version_id))
    return result.scalar_one()


async def get_document_detail(db: AsyncSession, doc_id: uuid.UUID):
    """Get document with sections (including active version content) and discovery questions."""
    result = await db.execute(
        select(Document)
        .options(
            selectinload(Document.sections).selectinload(Section.versions),
            selectinload(Document.discovery_questions),
        )
        .where(Document.id == doc_id)
    )
    return result.scalar_one_or_none()
