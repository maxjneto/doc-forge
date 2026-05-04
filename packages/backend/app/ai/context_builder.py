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
) -> str:
    """Build the user message for generation phase."""
    parts = [
        f"## Consolidated Context\n{general_context}",
    ]
    if user_preferences:
        parts.append(f"\n## Preferences\n{user_preferences}")
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

    context_block = f"## Consolidated Context\n{general_context}"
    if cross_section_context:
        context_block += f"\n\n{cross_section_context}"
    context_block += f"\n\n## Current Section Content\n{current_content}"

    messages = [{"role": "user", "content": context_block}]

    # Add chat history (last 20)
    for msg in chat_history[-20:]:
        role = role_map.get(str(msg.get("role", "")).lower(), "user")
        content = msg.get("content", "")
        messages.append({"role": role, "content": str(content)})

    # Add current user message
    messages.append({"role": "user", "content": user_message})
    return messages


def build_audit_context(sections_content: dict[str, str]) -> str:
    """Build the user message for audit phase."""
    parts = []
    for section_type in ["context", "proposal", "implementation", "risks"]:
        content = sections_content.get(section_type, "(Section not available)")
        parts.append(f"=== SECTION: {section_type.upper()} ===\n{content}")
    return "\n\n".join(parts)
