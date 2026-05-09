import json

from loguru import logger

from app.ai.context_builder import build_refinement_context
from app.ai.guardrails import call_with_retry
from app.ai.token_budget import log_usage

BASE_PERSONA = """You are a senior technical editor collaborating with an author to refine a document section.

Global rules:
- NEVER fabricate information not present in the provided context or existing section content.
- When rewriting, preserve the section's structure unless the user explicitly asks to change it.
- When updating Mermaid diagrams, produce syntactically valid Mermaid. Test your logic before outputting.
- Use the appropriate tool based on what the user is asking — do not default to edits when a question is asked."""

REFINEMENT_PHASE_DIRECTIVE = (
    "The user may request edits, ask analytical questions, or submit text for review. "
    "Decide whether to answer the question (use `answer_question`) or apply an edit (use `request_edit`). "
    "If the user explicitly asks to change the content, always use `request_edit` with the FULL rewritten section. "
    "If the user asks a question about the content or document structure, use `answer_question`."
)

REFINEMENT_SECTION_DIRECTIVES = {
    "context": (
        "This section describes the problem only — no solution. "
        "When editing: maintain narrative flow, urgency, and problem specificity. "
        "Reject any edits that introduce solution language into this section."
    ),
    "proposal": (
        "This section must always contain an architecture Mermaid diagram. "
        "When editing: if the user's change affects the architecture, update the diagram accordingly. "
        "Preserve the technical-executive tone."
    ),
    "implementation": (
        "This section must always contain at least one Mermaid diagram (sequence, ER, or flowchart). "
        "When editing: if component relationships or flows change, update the relevant diagram. "
        "Preserve numbered phases and component-level detail."
    ),
    "risks": (
        "This section uses a risk table and a discarded-alternatives list. "
        "When editing: keep the table structure intact. Only add risks traceable to specific design decisions. "
        "Do not add generic risks."
    ),
}


def build_refinement_system_prompt(section_type: str) -> str:
    parts = [BASE_PERSONA, "", REFINEMENT_PHASE_DIRECTIVE]
    section_directive = REFINEMENT_SECTION_DIRECTIVES.get(section_type)
    if section_directive:
        parts.extend(["", section_directive])
    return "\n".join(parts)

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


async def refine_section(
    section_type: str,
    general_context: str,
    current_content: str,
    cross_section_context: str,
    chat_history: list[dict],
    user_message: str,
    forced_tool_name: str | None = None,
    document_contract: dict | None = None,
) -> dict:
    """Process a refinement interaction using function calling."""
    logger.info(
        "[AI:refinement] refine_section | type={} history_msgs={} forced_tool={}",
        section_type,
        len(chat_history),
        forced_tool_name or "auto-required",
    )
    system_prompt = build_refinement_system_prompt(section_type)
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

    # Fallback: treat as answer
    logger.warning("[AI:refinement] no tool call returned, falling back to answer_question")
    return {"tool": "answer_question", "reply": message.content or ""}
