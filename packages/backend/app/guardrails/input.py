"""Input guardrails: validate user content before it reaches any AI call."""
import json
from dataclasses import dataclass

from loguru import logger

from app.ai.core.prompt_loader import load_yaml_prompt


@dataclass
class ValidationError:
    field: str
    message: str


def validate_document_context(context: str) -> ValidationError | None:
    """Validate the initial document context the user provides at creation time."""
    stripped = context.strip()

    if len(stripped) < 20:
        return ValidationError(
            field="document_context",
            message="Document idea is too short. Please describe the problem or change you want to document in at least a sentence.",
        )

    words = stripped.split()
    if len(words) < 4:
        return ValidationError(
            field="document_context",
            message="Document idea must be more than a few words. Describe the problem or goal you want to address.",
        )

    # Reject inputs that are pure punctuation / numbers / repeated chars
    alpha_ratio = sum(c.isalpha() for c in stripped) / max(len(stripped), 1)
    if alpha_ratio < 0.4:
        return ValidationError(
            field="document_context",
            message="Document idea doesn't seem to contain enough descriptive text. Please write a sentence explaining what you want to document.",
        )

    # Reject single-word inputs even if long (e.g. "aaaaaaaaaaaaaaaaaaaaaa")
    if len(words) == 1:
        return ValidationError(
            field="document_context",
            message="Please describe your document idea in a full sentence, not a single word.",
        )

    return None


def validate_discovery_answer(answer: str) -> ValidationError | None:
    """Validate a user answer to a discovery question."""
    if not answer:
        return None  # None answer = skip, which is allowed

    stripped = answer.strip()

    if len(stripped) < 2:
        return ValidationError(
            field="answer",
            message="Answer is too short. Please provide a meaningful response or skip the question.",
        )

    # Reject answers that are just punctuation or special chars
    alpha_ratio = sum(c.isalpha() or c.isdigit() for c in stripped) / max(len(stripped), 1)
    if alpha_ratio < 0.3:
        return ValidationError(
            field="answer",
            message="Answer doesn't appear to contain readable text. Please provide a real answer or skip.",
        )

    return None


def validate_refinement_message(message: str) -> ValidationError | None:
    """Validate a user message sent during the refinement phase."""
    stripped = message.strip() if message else ""

    if len(stripped) < 3:
        return ValidationError(
            field="message",
            message="Message is too short. Please describe the change or question you have.",
        )

    return None


_INTENT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "message_validity",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "is_valid": {"type": "boolean"},
                "reason": {"type": "string"},
            },
            "required": ["is_valid", "reason"],
            "additionalProperties": False,
        },
    },
}


async def validate_message_intent(message: str, section_type: str, section_summary: str | None = None) -> ValidationError | None:
    """LLM-based intent classifier: rejects messages unrelated to document editing.

    Failures are swallowed — a guardrail error must never block the user.
    """
    from app.ai.core.client import client, GUARDRAIL_MODEL
    from openai import BadRequestError

    system_prompt = load_yaml_prompt("guardrails", "intent_classification", "system")

    try:
        response = await client.chat.completions.create(
            model=GUARDRAIL_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Section: {section_type}\nSummary: {section_summary}\nMessage: {message}",
                },
            ],
            response_format=_INTENT_SCHEMA,
            temperature=0.0,
        )
        result = json.loads(response.choices[0].message.content)
        if not result.get("is_valid", True):
            logger.warning(
                "[input_guardrail] message rejected | section={} reason={}",
                section_type,
                result.get("reason"),
            )
            return ValidationError(
                field="message",
                message="Your message doesn't appear to be a document editing request. Please ask questions or request changes related to this section.",
            )
    except BadRequestError as exc:
        # Azure content filter blocked the message — treat as a confirmed rejection,
        # not a transient failure. Passing through would send the flagged content to
        # the main model, which would also block and crash the Inngest step.
        body = exc.body if isinstance(exc.body, dict) else {}
        if (body.get("error") or {}).get("code") == "content_filter":
            logger.warning(
                "[input_guardrail] Azure content filter blocked message | section={}",
                section_type,
            )
            return ValidationError(
                field="message",
                message="Your message was flagged by the content policy. Please keep your requests related to document editing.",
            )
        logger.warning("[input_guardrail] classifier request failed, passing through | error={}", exc)
    except Exception as exc:
        logger.warning("[input_guardrail] classifier failed, passing through | error={}", exc)

    return None
