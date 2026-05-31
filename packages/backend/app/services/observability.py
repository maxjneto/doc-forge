"""PostHog AI observability helpers — trace and span capture for document workflows."""
from app.ai.core.client import posthog_client


def capture_trace(
    distinct_id: str,
    doc_id: str,
    *,
    span_name: str | None = None,
    input_state: str | None = None,
    output_state: str | None = None,
) -> None:
    if posthog_client is None:
        return
    properties: dict = {"$ai_trace_id": doc_id}
    if span_name is not None:
        properties["$ai_span_name"] = span_name
    if input_state is not None:
        properties["$ai_input_state"] = input_state
    if output_state is not None:
        properties["$ai_output_state"] = output_state
    posthog_client.capture(distinct_id=distinct_id, event="$ai_trace", properties=properties)


def capture_span(
    distinct_id: str,
    doc_id: str,
    span_id: str,
    span_name: str,
    *,
    parent_id: str | None = None,
    input_state: str | None = None,
    output_state: str | None = None,
) -> None:
    if posthog_client is None:
        return
    properties: dict = {
        "$ai_trace_id": doc_id,
        "$ai_span_id": span_id,
        "$ai_span_name": span_name,
    }
    if parent_id is not None:
        properties["$ai_parent_id"] = parent_id
    if input_state is not None:
        properties["$ai_input_state"] = input_state
    if output_state is not None:
        properties["$ai_output_state"] = output_state
    posthog_client.capture(distinct_id=distinct_id, event="$ai_span", properties=properties)
