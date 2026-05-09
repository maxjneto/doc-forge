from app.ai.truncation import truncate_section, truncate_chat_history, build_context_report


def _render_contract_block(contract: dict | None) -> str:
    """Render a DocumentContract dict as a Markdown block for prompt injection."""
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


def build_discovery_context(
    document_context: str,
    user_preferences: str,
    follow_up_answers: list[dict],
) -> str:
    """Build the user message content for discovery phase."""
    parts = [
        f"## Document Context\n{document_context}",
    ]
    if user_preferences:
        parts.append(f"\n## User Preferences\n{user_preferences}")
    if follow_up_answers:
        parts.append("\n## Previous Questions and Answers")
        for qa in follow_up_answers:
            answer_text = qa["answer"] if qa["answer"] else "(Skipped by user)"
            parts.append(f"- **Q:** {qa['question']}\n  **A:** {answer_text}")
    return "\n".join(parts)


def build_alignment_context(
    general_context: str,
    user_preferences: str,
    rejected_sections: list[dict] | None = None,
) -> str:
    """Build the user message for alignment phase."""
    parts = [
        f"## Consolidated Context\n{general_context}",
    ]
    if user_preferences:
        parts.append(f"\n## Preferences\n{user_preferences}")
    if rejected_sections:
        parts.append("\n## Rejected Summaries (regenerate only these)")
        for r in rejected_sections:
            parts.append(f"- **{r['section']}**: {r.get('reason', 'No reason provided')}")
    return "\n".join(parts)


def build_generation_context(
    general_context: str,
    user_preferences: str,
    section_summary: str,
    cross_section_context: str,
    document_contract: dict | None = None,
) -> str:
    """Build the user message for generation phase."""
    cross_section_context = truncate_section(cross_section_context, "generation", "cross_section")
    build_context_report("generation", {
        "general_context": general_context,
        "section_summary": section_summary,
        "cross_section": cross_section_context,
    })
    parts = [
        f"## Consolidated Context\n{general_context}",
    ]
    if user_preferences:
        parts.append(f"\n## Preferences\n{user_preferences}")
    contract_block = _render_contract_block(document_contract)
    if contract_block:
        parts.append(f"\n{contract_block}")
    parts.append(f"\n## Approved Summary for this Section\n{section_summary}")
    if cross_section_context:
        parts.append(f"\n{cross_section_context}")
    return "\n".join(parts)


def build_refinement_context(
    general_context: str,
    current_content: str,
    cross_section_context: str,
    chat_history: list[dict],
    user_message: str,
    document_contract: dict | None = None,
) -> list[dict]:
    """Build message list for refinement phase (function calling)."""
    role_map = {
        "agent": "assistant",
        "assistant": "assistant",
        "user": "user",
        "system": "system",
        "developer": "developer",
        "tool": "tool",
    }

    current_content = truncate_section(current_content, "refinement", "section_content")
    chat_history = truncate_chat_history(chat_history)
    build_context_report("refinement", {
        "general_context": general_context,
        "current_content": current_content,
        "cross_section": cross_section_context,
    })

    context_block = f"## Consolidated Context\n{general_context}"
    contract_block = _render_contract_block(document_contract)
    if contract_block:
        context_block += f"\n\n{contract_block}"
    if cross_section_context:
        context_block += f"\n\n{cross_section_context}"
    context_block += f"\n\n## Current Section Content\n{current_content}"

    messages = [{"role": "user", "content": context_block}]

    for msg in chat_history:
        role = role_map.get(str(msg.get("role", "")).lower(), "user")
        content = msg.get("content", "")
        messages.append({"role": role, "content": str(content)})

    messages.append({"role": "user", "content": user_message})
    return messages


def build_audit_context(
    sections_content: dict[str, str],
    section_order: list[str] | None = None,
    document_contract: dict | None = None,
) -> str:
    """Build the user message for audit phase."""
    order = section_order or ["context", "proposal", "implementation", "risks"]
    build_context_report("audit", {k: v for k, v in sections_content.items()})
    parts = []
    contract_block = _render_contract_block(document_contract)
    if contract_block:
        parts.append(contract_block)
    for section_type in order:
        content = sections_content.get(section_type, "(Section not available)")
        content = truncate_section(content, "audit", section_type)
        parts.append(f"=== SECTION: {section_type.upper()} ===\n{content}")
    return "\n\n".join(parts)
