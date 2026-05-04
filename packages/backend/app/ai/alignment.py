import json

from loguru import logger

from app.ai.client import client, DEFAULT_MODEL
from app.ai.context_builder import build_alignment_context

ALIGNMENT_SYSTEM_PROMPT = """You are DocForge, a co-pilot specialized in creating technical RFCs.
You write in a direct, technical, and concise manner.
When requested, you generate valid Mermaid diagrams directly in Markdown.
You NEVER fabricate information that the user has not provided.

Your task is to generate 1-2 sentence summaries that will serve as direction for each section.
Be concise and precise."""

ALIGNMENT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "alignment_summaries",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "summaries": {
                    "type": "object",
                    "properties": {
                        "context": {"type": "string"},
                        "proposal": {"type": "string"},
                        "implementation": {"type": "string"},
                        "risks": {"type": "string"},
                    },
                    "required": ["context", "proposal", "implementation", "risks"],
                    "additionalProperties": False,
                }
            },
            "required": ["summaries"],
            "additionalProperties": False,
        },
    },
}


async def generate_alignment(
    general_context: str,
    user_preferences: str | None,
    rejected_sections: list[dict] | None = None,
) -> dict:
    """Generate 1-2 sentence summaries for each section."""
    logger.info(
        "[AI:alignment] generate_alignment | rejected_sections={}",
        rejected_sections or [],
    )
    system_prompt = ALIGNMENT_SYSTEM_PROMPT
    user_content = build_alignment_context(
        general_context, user_preferences or "", rejected_sections
    )

    response = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=ALIGNMENT_SCHEMA,
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    summaries = result.get("summaries", {})
    logger.info(
        "[AI:alignment] summaries generated for sections: {}",
        list(summaries.keys()),
    )
    return result
