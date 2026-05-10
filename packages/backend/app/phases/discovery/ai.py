import json
import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.core import get_system_prompt, log_usage
from app.guardrails import call_with_retry

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


def build_discovery_context(
    document_context: str,
    user_preferences: str,
    follow_up_answers: list[dict],
) -> str:
    parts = [f"## Document Context\n{document_context}"]
    if user_preferences:
        parts.append(f"\n## User Preferences\n{user_preferences}")
    if follow_up_answers:
        parts.append("\n## Previous Questions and Answers")
        for qa in follow_up_answers:
            answer_text = qa["answer"] if qa["answer"] else "(Skipped by user)"
            parts.append(f"- **Q:** {qa['question']}\n  **A:** {answer_text}")
    return "\n".join(parts)


async def analyze_discovery(
    document_context: str,
    user_preferences: str,
    follow_up_answers: list[dict],
    db: AsyncSession,
    document_type_id: uuid.UUID | None,
) -> dict:
    """Analyze if context is sufficient or generate follow-up questions."""
    logger.info(
        "[AI:discovery] analyze_discovery | answers_so_far={}",
        len(follow_up_answers),
    )
    system_prompt = await get_system_prompt(db, document_type_id, "discovery")
    user_content = build_discovery_context(document_context, user_preferences, follow_up_answers)

    response = await call_with_retry(
        phase="discovery",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=DISCOVERY_SCHEMA,
        temperature=0.3,
        required_fields=["is_sufficient", "follow_up_questions"],
    )

    log_usage("discovery", response.usage)
    result = json.loads(response.choices[0].message.content)

    if result.get("follow_up_questions"):
        result["follow_up_questions"] = result["follow_up_questions"][:3]

    logger.info(
        "[AI:discovery] result | is_sufficient={} questions={}",
        result.get("is_sufficient"),
        len(result.get("follow_up_questions", [])),
    )
    return result
