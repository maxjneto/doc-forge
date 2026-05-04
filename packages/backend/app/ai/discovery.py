import json

from loguru import logger

from app.ai.client import client, DEFAULT_MODEL
from app.ai.context_builder import build_discovery_context

DISCOVERY_SYSTEM_PROMPT = """You are DocForge, a co-pilot specialized in creating technical RFCs.
You write in a direct, technical, and concise manner.
When requested, you generate valid Mermaid diagrams directly in Markdown.
You NEVER fabricate information that the user has not provided.

Your task is to evaluate whether the provided context is sufficient to generate an RFC with 4 sections:
Context, Proposal, Implementation, Risks. Ask objective questions about gaps.
Do not generate content yet.
Return at most 3 follow-up questions per round.
NEVER repeat a question that has already been answered or skipped in the 'Previous Questions and Answers' section."""

DISCOVERY_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "discovery_analysis",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "is_sufficient": {"type": "boolean"},
                "consolidated_context": {"type": ["string", "null"]},
                "follow_up_questions": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "ask_for_assets": {"type": "boolean"},
            },
            "required": ["is_sufficient", "consolidated_context", "follow_up_questions", "ask_for_assets"],
            "additionalProperties": False,
        },
    },
}


async def analyze_discovery(
    document_context: str,
    user_preferences: str,
    follow_up_answers: list[dict],
) -> dict:
    """Analyze if context is sufficient or generate follow-up questions."""
    logger.info(
        "[AI:discovery] analyze_discovery | answers_so_far={}",
        len(follow_up_answers),
    )
    system_prompt = DISCOVERY_SYSTEM_PROMPT
    user_content = build_discovery_context(document_context, user_preferences, follow_up_answers)

    response = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=DISCOVERY_SCHEMA,
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)

    # Enforce max 3 questions per round
    if result.get("follow_up_questions"):
        result["follow_up_questions"] = result["follow_up_questions"][:3]

    logger.info(
        "[AI:discovery] result | is_sufficient={} questions={}",
        result.get("is_sufficient"),
        len(result.get("follow_up_questions", [])),
    )
    return result
