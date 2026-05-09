import json

from loguru import logger

from app.ai.context_builder import build_alignment_context
from app.ai.guardrails import call_with_retry
from app.ai.token_budget import log_usage

ALIGNMENT_SYSTEM_PROMPT = """You are a technical lead reviewing a project brief before writing begins.

Your task is to produce a tightly scoped 1-3 sentence directional summary for each document section. These summaries are the contract between you and the writer — the writer will generate full content that strictly follows them.

Requirements per section:
- **Context**: Name the specific problem, affected system(s), and the consequence of NOT acting. Do not describe the solution.
- **Proposal**: Name the chosen solution approach and one or two key technical choices. One sentence on the core mechanism, one on what changes.
- **Implementation**: Identify the primary components being changed, the integration strategy, and whether any data migration or phased rollout is needed.
- **Risks**: Name the top two real risks (not generic ones like "downtime") and note whether alternatives were evaluated.

Constraints:
- Use present tense and imperative phrasing ("Describe X", "Cover Y").
- NEVER fabricate entities, technologies, or decisions not present in the provided context.
- If a section has insufficient input to summarize, write the best summary possible from available context and flag ambiguity explicitly within the summary text."""

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
