"""Output guardrails: validate structured AI responses and retry once on failure."""
import json
from typing import Any

from loguru import logger

from app.ai.client import client, DEFAULT_MODEL


async def call_with_retry(
    *,
    phase: str,
    messages: list[dict],
    response_format: dict | None = None,
    tools: list[dict] | None = None,
    tool_choice: Any = None,
    temperature: float = 0.3,
    required_fields: list[str] | None = None,
    section_type: str | None = None,
) -> Any:
    """
    Call the AI model and validate the structured response.

    On malformed JSON or missing required fields, retries once with a corrective
    user message appended. Logs all guardrail triggers.
    """
    label = f"{phase}:{section_type}" if section_type else phase

    kwargs: dict[str, Any] = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format
    if tools is not None:
        kwargs["tools"] = tools
    if tool_choice is not None:
        kwargs["tool_choice"] = tool_choice

    response = await client.chat.completions.create(**kwargs)
    error = _validate_response(response, required_fields)

    if error is None:
        return response

    logger.warning(
        "[output_guardrail] invalid response | phase={} error={} — retrying once",
        label,
        error,
    )

    retry_messages = list(messages) + [
        {
            "role": "user",
            "content": (
                f"Your previous response was invalid: {error}. "
                "Please retry and return a valid response that matches the required schema exactly."
            ),
        }
    ]
    kwargs["messages"] = retry_messages
    retry_response = await client.chat.completions.create(**kwargs)
    retry_error = _validate_response(retry_response, required_fields)

    if retry_error:
        logger.error(
            "[output_guardrail] retry also invalid | phase={} error={}",
            label,
            retry_error,
        )
    else:
        logger.info("[output_guardrail] retry succeeded | phase={}", label)

    return retry_response


def _validate_response(response: Any, required_fields: list[str] | None) -> str | None:
    """Return an error description string if the response is invalid, else None."""
    message = response.choices[0].message

    # For tool-call responses, check a tool call was returned
    if message.tool_calls is not None or getattr(message, "tool_calls", None) == []:
        if not message.tool_calls:
            return "Expected a tool call but model returned no tool calls"
        return None

    # For structured JSON responses
    raw = message.content
    if not raw or not raw.strip():
        return "Empty response content"

    if required_fields:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            return f"Invalid JSON: {exc}"

        missing = [f for f in required_fields if f not in parsed]
        if missing:
            return f"Missing required fields: {missing}"

    return None
