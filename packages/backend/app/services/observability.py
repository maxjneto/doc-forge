"""PostHog product analytics. Every helper is a no-op unless POSTHOG_ENABLED and a key are set.

Who an event is about depends on the person's cookie choice (users.analytics_consent):
- accepted: their Clerk user id, so server events join their browser events and profile;
- declined or never answered (an MCP-only user never sees the banner): a one-way
  pseudonym (`anon_<HMAC>`), with no person profile and no `$set`. The usage still
  counts, but nobody can tie it back to the account.

Events never carry document text. Names are `object_action` in the past tense; who
acted goes in `source` (agent | person). Catalogue: docs/architecture/analytics.md.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import TYPE_CHECKING, Any

from loguru import logger
from posthog import Posthog

from app.config import settings

if TYPE_CHECKING:
    from app.models.user import User

posthog_client: Posthog | None = None
if settings.POSTHOG_ENABLED and settings.POSTHOG_API_KEY:
    posthog_client = Posthog(
        settings.POSTHOG_API_KEY,
        host=settings.POSTHOG_HOST,
        super_properties={
            "environment": "production" if settings.IS_PRODUCTION else "development",
            "app_version": settings.APP_VERSION,
            "app": "backend",
        },
    )
    if not settings.POSTHOG_ANON_SALT:
        logger.warning("[analytics] POSTHOG_ANON_SALT is not set; pseudonyms fall back to a key derived from DATABASE_URL")

def _salt() -> bytes:
    secret = settings.POSTHOG_ANON_SALT or hashlib.sha256(f"docforge-anon:{settings.DATABASE_URL}".encode()).hexdigest()
    return secret.encode()


def pseudonym(user_id: str) -> str:
    return "anon_" + hmac.new(_salt(), user_id.encode(), hashlib.sha256).hexdigest()[:32]


def _identity(actor: User | str | None) -> tuple[str, bool]:
    """(distinct_id, identified). A bare id or a missing choice is never identified."""
    if actor is None:
        return "anon_system", False
    if isinstance(actor, str):
        return pseudonym(actor), False
    # Read the loaded state, never trigger a load: after a rollback the instance is
    # expired, and a lazy load from here would fail outside the request's session.
    loaded = getattr(actor, "__dict__", {})
    user_id = loaded.get("id")
    if not user_id:
        return "anon_system", False
    if loaded.get("analytics_consent") == "accepted":
        return user_id, True
    return pseudonym(user_id), False


def source_of(request: Any) -> str:
    """Who acted: an agent (API key, i.e. MCP) or a person (signed in to the app)."""
    return "agent" if getattr(getattr(request, "state", None), "api_key_id", None) else "person"


def capture(
    actor: User | str | None,
    event: str,
    properties: dict[str, Any] | None = None,
    *,
    person: dict[str, Any] | None = None,
) -> None:
    """Send one event. `person` becomes `$set` only for people who accepted analytics."""
    if posthog_client is None:
        return
    distinct_id, identified = _identity(actor)
    props: dict[str, Any] = {k: v for k, v in (properties or {}).items() if v is not None}
    if identified:
        if person:
            props["$set"] = person
    else:
        props["$process_person_profile"] = False
    try:
        posthog_client.capture(event, distinct_id=distinct_id, properties=props)
    except Exception as e:  # noqa: BLE001 — analytics never breaks a request
        logger.debug("[analytics] capture failed: {}", e)


def capture_event(
    actor: User | str | None,
    doc_id: str,
    event_name: str,
    properties: dict | None = None,
) -> None:
    """An event about one document; the document id travels as `document_id`."""
    capture(actor, event_name, {"document_id": str(doc_id), **(properties or {})})


def capture_account_event(
    actor: User | str | None,
    event_name: str,
    properties: dict | None = None,
    *,
    person: dict[str, Any] | None = None,
) -> None:
    """Account-level event with no document context (e.g. plan changes)."""
    capture(actor, event_name, properties, person=person)


def capture_exception(exc: BaseException, properties: dict[str, Any] | None = None) -> None:
    """An unhandled error. Never tied to a person: errors can carry anything."""
    if posthog_client is None:
        return
    try:
        posthog_client.capture_exception(
            exc, distinct_id="anon_system", properties={"$process_person_profile": False, **(properties or {})}
        )
    except Exception as e:  # noqa: BLE001
        logger.debug("[analytics] capture_exception failed: {}", e)


def shutdown() -> None:
    """Send what is still queued. The client batches in a background thread, so
    without this every deploy or restart drops the last events."""
    if posthog_client is not None:
        posthog_client.shutdown()
