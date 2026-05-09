"""Document contract extraction — runs after alignment approval."""
import json

from loguru import logger

from app.ai.guardrails import call_with_retry
from app.ai.token_budget import log_usage

CONTRACT_SYSTEM_PROMPT = """You are a technical analyst extracting a structured contract from approved document section summaries.

The contract is a compact, authoritative summary that all subsequent sections must respect. It captures the non-negotiable facts agreed during alignment.

Extract the following:
- **entities**: The key systems, services, databases, teams, or external dependencies named in the document. Each entity is a string (e.g. "PostgreSQL", "AuthService", "mobile team").
- **decisions**: The key design decisions already made. Each decision is a string in the form "Chose X over Y because Z" or "Will use X for Y". These are constraints — writers must not contradict them.
- **terminology**: An array of canonical term/definition pairs. Use the exact names from the alignment summaries (e.g. [{"term": "AuthService", "definition": "The internal authentication microservice"}]).
- **constraints**: Hard constraints on the implementation (e.g. "Must not break backward compatibility", "Must complete migration within one release cycle"). Each constraint is a string.

Rules:
- Only extract what is explicitly stated in the input. Do NOT infer or add anything not present.
- Use precise, unambiguous language. Avoid vague terms like "system" or "service" without naming them.
- If a field has no applicable content, return an empty array or object."""

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

    response = await call_with_retry(
        phase="contract",
        messages=[
            {"role": "system", "content": CONTRACT_SYSTEM_PROMPT},
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
