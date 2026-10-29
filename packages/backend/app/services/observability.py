"""PostHog product analytics. Every helper is a no-op unless POSTHOG_ENABLED and a key are set."""
from posthog import Posthog

from app.config import settings

posthog_client: Posthog | None = None
if settings.POSTHOG_ENABLED and settings.POSTHOG_API_KEY:
    posthog_client = Posthog(settings.POSTHOG_API_KEY, host=settings.POSTHOG_HOST)


def capture_event(
    distinct_id: str,
    doc_id: str,
    event_name: str,
    properties: dict | None = None,
) -> None:
    """An event about one document; the document id travels as `document_id`."""
    if posthog_client is None:
        return
    full_props: dict = {"document_id": doc_id, **(properties or {})}
    posthog_client.capture(distinct_id=distinct_id, event=event_name, properties=full_props)


def capture_account_event(
    distinct_id: str,
    event_name: str,
    properties: dict | None = None,
) -> None:
    """Account-level event with no document context (e.g. plan changes) —
    use capture_event instead when the event is scoped to a document."""
    if posthog_client is None:
        return
    posthog_client.capture(distinct_id=distinct_id, event=event_name, properties=properties or {})
