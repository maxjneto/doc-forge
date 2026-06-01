import json
import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.core import (
    build_context_report,
    load_yaml_prompt,
    log_usage,
    truncate_chat_history,
    truncate_section,
)
from app.guardrails import call_with_retry

REFINEMENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "answer_question",
            "description": "Answers the user's question without modifying the section text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reply": {
                        "type": "string",
                        "description": "Reply to the user's question",
                    }
                },
                "required": ["reply"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_edit",
            "description": "Rewrites the section and suggests a version name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "new_markdown": {
                        "type": "string",
                        "description": "Full rewritten section content in Markdown",
                    },
                    "version_name": {
                        "type": "string",
                        "description": "Short descriptive name (e.g., 'Added Redis')",
                    },
                },
                "required": ["new_markdown", "version_name"],
            },
        },
    },
]


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


def build_refinement_context(
    general_context: str,
    current_content: str,
    cross_section_context: str,
    chat_history: list[dict],
    user_message: str,
    document_contract: dict | None = None,
) -> list[dict]:
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


async def build_refinement_system_prompt(
    section_type: str,
    db: AsyncSession | None,
    document_type_id: uuid.UUID | None,
) -> str:
    if db is not None and document_type_id is not None:
        from app.services.db import get_prompt_template
        tmpl = await get_prompt_template(db, document_type_id, "refinement", section_type)
        if tmpl:
            return tmpl.prompt_text
    base_persona = load_yaml_prompt("documents", "refinement", "base_persona") or ""
    phase_directive = load_yaml_prompt("documents", "refinement", "phase_directive") or ""
    section_directive = load_yaml_prompt("documents", "refinement", "sections", section_type) or ""
    parts = [base_persona, "", phase_directive]
    if section_directive:
        parts.extend(["", section_directive])
    return "\n".join(parts)


async def refine_section(
    section_type: str,
    general_context: str,
    current_content: str,
    cross_section_context: str,
    chat_history: list[dict],
    user_message: str,
    forced_tool_name: str | None = None,
    document_contract: dict | None = None,
    db: AsyncSession | None = None,
    document_type_id: uuid.UUID | None = None,
    posthog_distinct_id: str | None = None,
    doc_id: str | None = None,
) -> dict:
    """Process a refinement interaction using function calling."""
    logger.info(
        "[AI:refinement] refine_section | type={} history_msgs={} forced_tool={}",
        section_type,
        len(chat_history),
        forced_tool_name or "auto-required",
    )
    system_prompt = await build_refinement_system_prompt(section_type, db, document_type_id)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(
        build_refinement_context(
            general_context, current_content, cross_section_context, chat_history, user_message,
            document_contract=document_contract,
        )
    )

    tool_choice = (
        {"type": "function", "function": {"name": forced_tool_name}}
        if forced_tool_name
        else "required"
    )

    response = await call_with_retry(
        phase="refinement",
        section_type=section_type,
        messages=messages,
        tools=REFINEMENT_TOOLS,
        tool_choice=tool_choice,
        temperature=0.4,
        posthog_distinct_id=posthog_distinct_id,
        posthog_properties=(
            {"$ai_trace_id": doc_id, "$ai_parent_id": f"refinement-{section_type}-{doc_id}"}
            if doc_id else None
        ),
    )

    log_usage("refinement", response.usage, section_type=section_type)
    message = response.choices[0].message
    if message.tool_calls:
        tool_call = message.tool_calls[0]
        args = json.loads(tool_call.function.arguments)
        if forced_tool_name and tool_call.function.name != forced_tool_name:
            logger.warning(
                "[AI:refinement] forced tool mismatch | expected={} got={}",
                forced_tool_name,
                tool_call.function.name,
            )
        logger.info(
            "[AI:refinement] tool selected | type={} tool={}",
            section_type,
            tool_call.function.name,
        )
        return {"tool": tool_call.function.name, **args}

    logger.warning("[AI:refinement] no tool call returned, falling back to answer_question")
    return {"tool": "answer_question", "reply": message.content or ""}
