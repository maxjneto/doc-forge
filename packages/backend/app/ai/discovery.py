import json

from loguru import logger

from app.ai.context_builder import build_discovery_context
from app.ai.guardrails import call_with_retry
from app.ai.token_budget import log_usage

DISCOVERY_SYSTEM_PROMPT = """You are a senior technical writer conducting a structured intake interview for a technical document.

Your job is to determine whether the information provided is sufficient to produce a high-quality document. The document will be divided into sections covering the problem context, the proposed solution, implementation details, and risks.

Evaluate the input against these criteria:
- Context: Is the problem clearly described? Is the pain or opportunity quantified or evidenced?
- Proposal: Is there a concrete solution direction? Are key technologies or patterns identified?
- Implementation: Are the major technical changes, affected systems, and integration points known?
- Risks: Are failure modes, dependencies, and discarded alternatives mentioned?

If ANY of these areas lack enough detail to write a substantive section, mark `is_sufficient` as false and ask targeted follow-up questions. Each question must address a specific gap — never ask generic questions like "Can you elaborate?".

Rules:
- Return at most 3 follow-up questions per round.
- NEVER repeat a question already answered or skipped.
- When context is sufficient, produce a `consolidated_context` that synthesizes ALL provided information (original context + all Q&A answers) into a single coherent narrative paragraph. Do not omit any detail the user provided.
- Set `ask_for_assets` to true only if diagrams, schemas, or external specs would meaningfully improve the document.
- Do NOT generate any document content yet."""

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

    # Enforce max 3 questions per round
    if result.get("follow_up_questions"):
        result["follow_up_questions"] = result["follow_up_questions"][:3]

    logger.info(
        "[AI:discovery] result | is_sufficient={} questions={}",
        result.get("is_sufficient"),
        len(result.get("follow_up_questions", [])),
    )
    return result
