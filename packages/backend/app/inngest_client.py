import inngest

from app.config import settings

inngest_kwargs = {
    "app_id": "docforge",
    "event_key": settings.INNGEST_EVENT_KEY or (None if settings.IS_PRODUCTION else "local"),
    "signing_key": settings.INNGEST_SIGNING_KEY or None,
    "is_production": settings.IS_PRODUCTION,
}

if not settings.IS_PRODUCTION:
    inngest_kwargs["api_base_url"] = settings.INNGEST_DEV_SERVER_URL
    inngest_kwargs["event_api_base_url"] = settings.INNGEST_DEV_SERVER_URL

inngest_client = inngest.Inngest(**inngest_kwargs)
