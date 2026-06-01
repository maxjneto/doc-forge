from posthog import Posthog
from posthog.ai.openai import AsyncOpenAI

from app.config import settings

posthog_client: Posthog | None = None
if settings.POSTHOG_ENABLED and settings.POSTHOG_API_KEY:
    posthog_client = Posthog(settings.POSTHOG_API_KEY, host=settings.POSTHOG_HOST)

client = AsyncOpenAI(
    base_url=settings.AZURE_OPENAI_ENDPOINT,
    api_key=settings.AZURE_OPENAI_API_KEY,
    posthog_client=posthog_client,
)
DEFAULT_MODEL = settings.AZURE_OPENAI_DEPLOYMENT
GUARDRAIL_MODEL = settings.AZURE_OPENAI_GUARDRAIL_DEPLOYMENT
