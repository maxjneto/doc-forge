from openai import AsyncOpenAI
from app.config import settings


client = AsyncOpenAI(
    base_url=settings.AZURE_OPENAI_ENDPOINT,
    api_key=settings.AZURE_OPENAI_API_KEY
)
DEFAULT_MODEL = settings.AZURE_OPENAI_DEPLOYMENT
GUARDRAIL_MODEL = settings.AZURE_OPENAI_GUARDRAIL_DEPLOYMENT
