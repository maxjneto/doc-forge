import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.core import (
    load_yaml_prompt,
    get_system_prompt,
    log_usage,
    clean_section_output,
    strip_outer_markdown_fence,
    truncate_section,
    build_context_report,
)
from app.guardrails import call_with_retry


def _render_contract_block(contract: dict | None) -> str:
    if not contract:
        return ""
    parts = ["## Document Contract", ""]
    entities = contract.get("entities") or []
    if entities:
        parts.append("**Key Entities:** " + ", ".join(entities))
    decisions = contract.get("decisions") or []
    if decisions:
        parts.append("\n**Design Decisions:**")
        for d in decisions:
            parts.append(f"- {d}")
    terminology = contract.get("terminology") or {}
    if terminology:
        parts.append("\n**Terminology:**")
        for term, definition in terminology.items():
            parts.append(f"- **{term}**: {definition}")
    constraints = contract.get("constraints") or []
    if constraints:
        parts.append("\n**Constraints:**")
        for c in constraints:
            parts.append(f"- {c}")
    return "\n".join(parts)


def build_generation_context(
    general_context: str,
    user_preferences: str,
    section_summary: str,
    cross_section_context: str,
    document_contract: dict | None = None,
) -> str:
    cross_section_context = truncate_section(cross_section_context, "generation", "cross_section")
    build_context_report("generation", {
        "general_context": general_context,
        "section_summary": section_summary,
        "cross_section": cross_section_context,
    })
    parts = [f"## Consolidated Context\n{general_context}"]
    if user_preferences:
        parts.append(f"\n## Preferences\n{user_preferences}")
    contract_block = _render_contract_block(document_contract)
    if contract_block:
        parts.append(f"\n{contract_block}")
    parts.append(f"\n## Approved Summary for this Section\n{section_summary}")
    if cross_section_context:
        parts.append(f"\n{cross_section_context}")
    return "\n".join(parts)


async def build_generation_system_prompt(
    section_type: str,
    db: AsyncSession | None,
    document_type_id: uuid.UUID | None,
) -> str:
    if db is not None and document_type_id is not None:
        from app.services.db import get_prompt_template
        tmpl = await get_prompt_template(db, document_type_id, "generation", section_type)
        if tmpl:
            return tmpl.prompt_text
    base_persona = load_yaml_prompt("documents", "generation", "base_persona") or ""
    phase_directive = load_yaml_prompt("documents", "generation", "phase_directive") or ""
    section_directive = load_yaml_prompt("documents", "generation", "sections", section_type) or ""
    parts = [base_persona, "", phase_directive]
    if section_directive:
        parts.extend(["", section_directive])
    return "\n".join(parts)


async def generate_section(
    section_type: str,
    general_context: str,
    user_preferences: str,
    section_summary: str,
    cross_section_context: str,
    document_contract: dict | None = None,
    db: AsyncSession | None = None,
    document_type_id: uuid.UUID | None = None,
) -> str:
    """Generate full markdown content for a section."""
    logger.info("[AI:generation] generating section | type={}", section_type)
    system_prompt = await build_generation_system_prompt(section_type, db, document_type_id)
    user_content = build_generation_context(
        general_context, user_preferences, section_summary, cross_section_context, document_contract
    )

    response = await call_with_retry(
        phase="generation",
        section_type=section_type,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
    )

    log_usage("generation", response.usage, section_type=section_type)
    content = strip_outer_markdown_fence(response.choices[0].message.content)
    logger.info(
        "[AI:generation] section done | type={} chars={}",
        section_type,
        len(content or ""),
    )
    return content


async def refine_cross_references(doc_id: str, document_type_id: str | None = None) -> None:
    """Run a coherence pass on all sections to ensure cross-references are accurate."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import async_session
    from app.models import Section
    from app.services import db as db_service

    logger.info("[AI:generation] refine_cross_references | doc_id={}", doc_id)
    async with async_session() as db:
        dt_id = uuid.UUID(document_type_id) if document_type_id else None
        coherence_prompt = await get_system_prompt(db, dt_id, "generation", "coherence")
        doc = await db_service.get_document_detail(db, uuid.UUID(doc_id))
        if not doc:
            return

        sections = doc.sections
        section_contents = {}
        for s in sections:
            active = next((v for v in s.versions if v.is_active), None)
            if active:
                section_contents[s.section_type] = active.content

        deps = {
            "proposal": ["context"],
            "implementation": ["context", "proposal"],
            "risks": ["context", "proposal", "implementation"],
        }

        for section_type, dep_types in deps.items():
            section = next((s for s in sections if s.section_type == section_type), None)
            if not section:
                continue

            current_content = section_contents.get(section_type, "")
            if not current_content:
                continue

            ref_parts = []
            for dep in dep_types:
                if dep in section_contents:
                    ref_parts.append(f"=== SECTION: {dep.upper()} ===\n{section_contents[dep]}\n=== END ===")

            reference_context = "\n\n".join(ref_parts)

            user_content = (
                f"## Section to review: {section_type.upper()}\n\n"
                f"{current_content}\n\n"
                f"## Other sections for reference:\n\n{reference_context}"
            )

            response = await call_with_retry(
                phase="generation:coherence",
                section_type=section_type,
                messages=[
                    {"role": "system", "content": coherence_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.2,
            )

            log_usage("generation:coherence", response.usage, section_type=section_type)
            refined_content = clean_section_output(response.choices[0].message.content, section_type)

            if refined_content and refined_content.strip() != current_content.strip():
                logger.info(
                    "[AI:generation] coherence pass updated section | type={}",
                    section_type,
                )
                active_version = next((v for v in section.versions if v.is_active), None)
                await db_service.create_section_version(
                    db,
                    section.id,
                    "Coherence pass",
                    refined_content,
                    parent_version_id=active_version.id if active_version else None,
                )
