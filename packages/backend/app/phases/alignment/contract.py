"""Document contract extraction — runs after alignment approval."""
import json
import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.core import load_yaml_prompt, get_system_prompt, log_usage
from app.guardrails import call_with_retry

CONTRACT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "document_contract",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "entities": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "decisions": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "terminology": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "term": {"type": "string"},
                            "definition": {"type": "string"},
                        },
                        "required": ["term", "definition"],
                        "additionalProperties": False,
                    },
                },
                "constraints": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": ["entities", "decisions", "terminology", "constraints"],
            "additionalProperties": False,
        },
    },
}


async def extract_document_contract(
    global_context: str,
    summaries: dict[str, str],
    user_preferences: str | None = None,
    db: AsyncSession | None = None,
    document_type_id: uuid.UUID | None = None,
) -> dict:
    """Extract a structured document contract from the approved alignment summaries."""
    logger.info("[AI:contract] extracting document contract")

    summary_block = "\n".join(
        f"**{section.title()}**: {text}" for section, text in summaries.items()
    )
    user_content = (
        f"## Consolidated Context\n{global_context}\n\n"
        f"## Approved Section Summaries\n{summary_block}"
    )
    if user_preferences:
        user_content += f"\n\n## User Preferences\n{user_preferences}"

    system_prompt = (
        await get_system_prompt(db, document_type_id, "contract")
        if db is not None
        else load_yaml_prompt("documents", "contract", "system")
    )

    response = await call_with_retry(
        phase="contract",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=CONTRACT_SCHEMA,
        temperature=0.1,
        required_fields=["entities", "decisions", "terminology", "constraints"],
    )

    log_usage("contract", response.usage)
    result = json.loads(response.choices[0].message.content)
    # Convert [{term, definition}] array back to {term: definition} dict
    if isinstance(result.get("terminology"), list):
        result["terminology"] = {
            entry["term"]: entry["definition"]
            for entry in result["terminology"]
            if "term" in entry and "definition" in entry
        }
    logger.info(
        "[AI:contract] extracted | entities={} decisions={} terms={} constraints={}",
        len(result.get("entities", [])),
        len(result.get("decisions", [])),
        len(result.get("terminology", {})),
        len(result.get("constraints", [])),
    )
    return result
