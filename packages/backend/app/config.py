from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5480/docforge"
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o-mini"
    AZURE_OPENAI_GUARDRAIL_DEPLOYMENT: str = "gpt-4o-mini"
    INNGEST_EVENT_KEY: str = ""
    INNGEST_SIGNING_KEY: str = ""
    INNGEST_DEV_SERVER_URL: str = "http://127.0.0.1:8288"
    # Optional Redis pub/sub for SSE fan-out across replicas.
    # Empty = in-process delivery only (requires replica=1).
    REDIS_URL: str = ""
    IS_PRODUCTION: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    CLERK_JWKS_URL: str = ""
    # Clerk does not include `aud` in tokens by default; `azp` (authorized party)
    # is the equivalent claim — set to your frontend origin(s) in production.
    CLERK_AUTHORIZED_PARTIES: list[str] = ["http://localhost:5173"]

    # Credit system — override via env vars to reconfigure without code changes
    WEEKLY_CREDITS: int = 5
    GUIDED_DOCUMENT_COST: int = 3
    EDITOR_DOCUMENT_COST: int = 1

    # Free tier limits (enforced in the backend; served via GET /api/tiers).
    # Calibrated generous on purpose — the MCP funnel is the growth engine.
    FREE_MAX_ACTIVE_DOCUMENTS: int = 10
    FREE_MAX_API_KEYS: int = 1

    # Quality gate: server-run audits consume credits (the DocForge-pays-tokens
    # rule); agent-run submissions are free — pro-BYOA incentive.
    QUALITY_GATE_COST: int = 1

    # Version retention (Free plan): oldest inactive versions beyond this count
    # are pruned when a new one is created. None/0 on paid plans (see tiers.py).
    FREE_MAX_VERSIONS_PER_SECTION: int = 20

    # Stripe billing — disabled by default; set STRIPE_ENABLED=true with real
    # test-mode (or live) keys to activate checkout/portal/webhooks.
    STRIPE_ENABLED: bool = False
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID_PRO: str = ""
    STRIPE_PRICE_ID_TEAM: str = ""
    STRIPE_PORTAL_RETURN_URL: str = "http://localhost:5173/billing"
    STRIPE_CHECKOUT_SUCCESS_URL: str = "http://localhost:5173/billing?checkout=success"
    STRIPE_CHECKOUT_CANCEL_URL: str = "http://localhost:5173/billing?checkout=cancel"

    # PostHog analytics — all disabled by default; set POSTHOG_ENABLED=true to activate
    POSTHOG_API_KEY: str = ""
    POSTHOG_HOST: str = "https://us.i.posthog.com"
    POSTHOG_ENABLED: bool = False
    POSTHOG_REDACT_PROMPTS: bool = True

    model_config = {"env_file": ENV_FILE, "extra": "ignore"}


settings = Settings()
