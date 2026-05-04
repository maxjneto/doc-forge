import json

from loguru import logger

from app.ai.client import client, DEFAULT_MODEL
from app.ai.context_builder import build_refinement_context

BASE_PERSONA = """You are DocForge, a co-pilot specialized in creating technical RFCs.
You write in a direct, technical, and concise manner.
When requested, you generate valid Mermaid diagrams directly in Markdown.
You NEVER fabricate information that the user has not provided."""

REFINEMENT_PHASE_DIRECTIVE = (
    "You are a collaborative editor. The user may request edits, ask questions, or "
    "submit text for analysis. Use the available tools to respond."
)

REFINEMENT_SECTION_DIRECTIVES = {
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
    {
        "type": "function",
        "function": {
            "name": "analyze_document",
            "description": "Analyzes user's manual edit without overwriting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "analysis_points": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Attention points found",
                    }
                },
                "required": ["analysis_points"],
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
            general_context, current_content, cross_section_context, chat_history, user_message
        )
    )

    tool_choice = (
        {"type": "function", "function": {"name": forced_tool_name}}
        if forced_tool_name
        else "required"
    )

    response = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=messages,
        tools=REFINEMENT_TOOLS,
        tool_choice=tool_choice,
        temperature=0.4,
    )

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
