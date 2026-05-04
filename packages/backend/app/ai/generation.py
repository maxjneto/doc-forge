from loguru import logger

from app.ai.client import client, DEFAULT_MODEL
from app.ai.context_builder import build_generation_context
from app.ai.output_cleaner import strip_outer_markdown_fence

BASE_PERSONA = """You are DocForge, a co-pilot specialized in creating technical RFCs.
You write in a direct, technical, and concise manner.
When requested, you generate valid Mermaid diagrams directly in Markdown.
You NEVER fabricate information that the user has not provided."""

GENERATION_PHASE_DIRECTIVE = (
    "Your task is to generate the full Markdown content for the requested section, "
    "following the approved summary as a guide. "
    "Return raw section content only: do NOT wrap the full response in triple backticks, "
    "and do NOT start with ```markdown."
)

GENERATION_SECTION_DIRECTIVES = {
    "context": (
        "Write in a narrative tone. Explain the problem with urgency and clarity. "
        "Do not propose solutions here - only describe the pain."
    ),
    "proposal": (
        "Write in a technical-executive tone. Describe the proposed solution and key changes. "
        "You MUST include at least one high-level architecture Mermaid diagram."
    ),
    "implementation": (
        "Write in a detailed technical tone. Describe the implementation sequence, data models, "
        "and integrations. You MUST include Mermaid diagrams (sequence, ER, or flowchart)."
    ),
    "risks": (
        "Write in objective bullet points. List real risks (not generic ones) and discarded alternatives "
        "with justification."
    ),
}


def build_generation_system_prompt(section_type: str) -> str:
    parts = [BASE_PERSONA, "", GENERATION_PHASE_DIRECTIVE]
    section_directive = GENERATION_SECTION_DIRECTIVES.get(section_type)
    if section_directive:
        parts.extend(["", section_directive])
    return "\n".join(parts)


async def generate_section(
    section_type: str,
    general_context: str,
    user_preferences: str,
    section_summary: str,
    cross_section_context: str,
) -> str:
    """Generate full markdown content for a section."""
    logger.info("[AI:generation] generating section | type={}", section_type)
    system_prompt = build_generation_system_prompt(section_type)
    user_content = build_generation_context(
        general_context, user_preferences, section_summary, cross_section_context
    )

    response = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
    )

    content = strip_outer_markdown_fence(response.choices[0].message.content)
    logger.info(
        "[AI:generation] section done | type={} chars={}",
        section_type,
        len(content or ""),
    )
    return content


COHERENCE_PROMPT = f"""{BASE_PERSONA}

Your task is to review a single section of an RFC for cross-reference accuracy.
All other sections have been generated. Check that:
- References to other sections are accurate (technologies, decisions, diagrams match)
- No contradictions exist with the referenced sections
- Terminology is consistent

If edits are needed, return the FULL corrected Markdown for this section.
If no changes needed, return the original content unchanged.
Return ONLY the section Markdown, no commentary.
Do NOT wrap the full response in triple backticks and do NOT start with ```markdown."""


async def refine_cross_references(doc_id: str) -> None:
    """Run a coherence pass on all sections to ensure cross-references are accurate."""
    import uuid
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import async_session
    from app.models import Section, SectionVersion
    from app.services import db as db_service

    logger.info("[AI:generation] refine_cross_references | doc_id={}", doc_id)
    async with async_session() as db:
        doc = await db_service.get_document_detail(db, uuid.UUID(doc_id))
        if not doc:
            return

        sections = doc.sections
        section_contents = {}
        for s in sections:
            active = next((v for v in s.versions if v.is_active), None)
            if active:
                section_contents[s.section_type] = active.content

        # Only refine sections that have dependencies (proposal, implementation, risks)
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

            # Build reference block from dependencies
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

            response = await client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": COHERENCE_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.2,
            )

            refined_content = strip_outer_markdown_fence(response.choices[0].message.content)

            # Only create a new version if content actually changed
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
