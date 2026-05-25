import json
import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.core import get_system_prompt, load_yaml_prompt, log_usage
from app.guardrails import call_with_retry

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


def build_alignment_context(
    section_contexts: dict[str, str],
    user_preferences: str,
    rejected_sections: list[dict] | None = None,
) -> str:
    parts = []
    for section_key, ctx in section_contexts.items():
        if ctx:
            parts.append(f"## {section_key.capitalize()} Section Context\n{ctx}")
    if not parts:
        parts.append("## Consolidated Context\n(No context available)")
    if user_preferences:
        parts.append(f"\n## Preferences\n{user_preferences}")
    if rejected_sections:
        parts.append("\n## Rejected Summaries (regenerate only these)")
        for r in rejected_sections:
            parts.append(f"- **{r['section']}**: {r.get('reason', 'No reason provided')}")
    return "\n\n".join(parts)


async def generate_alignment(
    section_contexts: dict[str, str],
    user_preferences: str | None,
    rejected_sections: list[dict] | None = None,
    db: AsyncSession | None = None,
    document_type_id: uuid.UUID | None = None,
) -> dict:
    """Generate 1-2 sentence summaries for each section using per-section discovery contexts."""
    logger.info(
        "[AI:alignment] generate_alignment | sections={} rejected_sections={}",
        list(section_contexts.keys()),
        rejected_sections or [],
    )
    system_prompt = (
        await get_system_prompt(db, document_type_id, "alignment")
        if db is not None
        else load_yaml_prompt("documents", "alignment", "system")
    )
    user_content = build_alignment_context(
        section_contexts, user_preferences or "", rejected_sections
    )

    response = await call_with_retry(
        phase="alignment",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=ALIGNMENT_SCHEMA,
        temperature=0.3,
        required_fields=["summaries"],
    )

    log_usage("alignment", response.usage)
    result = json.loads(response.choices[0].message.content)
    summaries = result.get("summaries", {})
    logger.info(
        "[AI:alignment] summaries generated for sections: {}",
        list(summaries.keys()),
    )
    return result
