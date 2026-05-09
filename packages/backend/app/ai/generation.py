from loguru import logger

from app.ai.context_builder import build_generation_context
from app.ai.guardrails import call_with_retry
from app.ai.output_cleaner import clean_section_output, strip_outer_markdown_fence
from app.ai.token_budget import log_usage

BASE_PERSONA = """You are an expert technical writer producing a section of a formal technical document.

Global rules:
- Ground every claim in the provided context. NEVER invent technologies, team names, metrics, or decisions not present in the input.
- Write with authority and precision. Avoid hedging phrases like "might", "could potentially", or "it is possible that".
- Use active voice and present tense for describing the system; use future tense only for planned changes.
- Output raw Markdown only. Do NOT wrap the response in triple backticks. Do NOT include a ```markdown opening fence."""

GENERATION_PHASE_DIRECTIVE = (
    "Generate the full Markdown content for the requested document section. "
    "Follow the approved summary as the directional contract — do not deviate from it. "
    "Produce substantive, professional content. Aim for 400-800 words unless the material demands more."
)

GENERATION_SECTION_DIRECTIVES = {
    "context": (
        "Write the Context section as a structured problem statement.\n"
        "Required structure:\n"
        "1. **Background** — What is the current system/process and what role does it play?\n"
        "2. **Problem Statement** — What specific problem exists? Describe symptoms, not root causes.\n"
        "3. **Impact** — What is the measurable or observable consequence of this problem? Who is affected?\n"
        "4. **Motivation** — Why must this be addressed now? What is the cost of inaction?\n\n"
        "Do NOT propose any solution. Do NOT mention the proposed technology stack. "
        "End with a clear, one-sentence problem summary."
    ),
    "proposal": (
        "Write the Proposal section as a technical executive summary of the solution.\n"
        "Required structure:\n"
        "1. **Overview** — One paragraph describing the proposed solution at a high level.\n"
        "2. **Architecture Diagram** — A Mermaid diagram (graph TD or C4-style) showing the proposed architecture. This is MANDATORY.\n"
        "3. **Key Design Decisions** — Bullet list of the 3-5 most important technical choices and WHY each was made.\n"
        "4. **Scope** — What is in scope and explicitly what is out of scope.\n\n"
        "The architecture Mermaid diagram is required. Use `graph TD` or `graph LR` syntax."
    ),
    "implementation": (
        "Write the Implementation section as a detailed technical specification.\n"
        "Required structure:\n"
        "1. **Implementation Phases** — Numbered phases with clear deliverables per phase.\n"
        "2. **Component Changes** — For each affected component: what changes, how it integrates, and any API contract changes.\n"
        "3. **Sequence Diagram** — A Mermaid sequence diagram showing the primary flow. This is MANDATORY.\n"
        "4. **Data Model** — If DB schema changes are needed, include a Mermaid ER diagram.\n"
        "5. **Rollout Strategy** — How will this be deployed? Feature flags, staged rollout, migration steps.\n\n"
        "Both a sequence diagram and any applicable ER diagrams are required."
    ),
    "risks": (
        "Write the Risks section as a structured risk register.\n"
        "Required structure:\n"
        "1. **Risk Table** — A Markdown table with columns: Risk | Likelihood | Impact | Mitigation.\n"
        "   List only real, specific risks derived from the proposal (not generic risks like 'downtime').\n"
        "   Minimum 3 risks, maximum 8.\n"
        "2. **Discarded Alternatives** — For each alternative considered: name it, explain why it was rejected in 1-2 sentences.\n"
        "3. **Open Questions** — Any unresolved decisions that must be answered before implementation begins.\n\n"
        "Do NOT include generic risks. Every risk must be traceable to a specific decision in the Proposal or Implementation section."
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
    document_contract: dict | None = None,
) -> str:
    """Generate full markdown content for a section."""
    logger.info("[AI:generation] generating section | type={}", section_type)
    system_prompt = build_generation_system_prompt(section_type)
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


COHERENCE_PROMPT = f"""{BASE_PERSONA}

You are performing a cross-section coherence review on a single document section. The other sections are provided as reference.

Review the target section for these issues:
1. **Terminology consistency** — Are the same concepts named the same way as in the other sections?
2. **Technology alignment** — Are the technologies mentioned consistent with what was decided in the Proposal?
3. **Factual accuracy** — Does this section make claims that contradict specific statements in other sections?
4. **Diagram accuracy** — If diagrams reference components or flows from other sections, are they consistent?

Correction rules:
- Fix only genuine inconsistencies. Do NOT rewrite content that is correct.
- Preserve the original section structure. Do NOT add new content unless fixing an inconsistency requires it.
- If no corrections are needed, return the original content EXACTLY unchanged.
- Return ONLY the section Markdown. No commentary, no explanation.
- Do NOT wrap the response in triple backticks."""


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

            response = await call_with_retry(
                phase="generation:coherence",
                section_type=section_type,
                messages=[
                    {"role": "system", "content": COHERENCE_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.2,
            )

            log_usage("generation:coherence", response.usage, section_type=section_type)
            refined_content = clean_section_output(response.choices[0].message.content, section_type)

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
