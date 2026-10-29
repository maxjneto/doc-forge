from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5480/docforge"
    # Optional Redis pub/sub for SSE fan-out across replicas.
    # Empty = in-process delivery only (requires replica=1).
    REDIS_URL: str = ""
    IS_PRODUCTION: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    CLERK_JWKS_URL: str = ""
    # Clerk does not include `aud` in tokens by default; `azp` (authorized party)
    # is the equivalent claim — set to your frontend origin(s) in production.
    CLERK_AUTHORIZED_PARTIES: list[str] = ["http://localhost:5173"]

    # Document creation quotas — override via env vars to reconfigure without
    # code changes. The database column retains its historical `credits` name
    # for a backwards-compatible migration, but its product meaning is one
    # document creation per unit.
    FREE_WEEKLY_DOCUMENT_CREDITS: int = 15
    PRO_WEEKLY_DOCUMENT_CREDITS: int = 100

    # Plan limits (enforced in the backend; served via GET /api/tiers). Free is
    # generous on purpose: everything DocForge does is in it, Pro only lifts the
    # limits of people who use it every day.
    FREE_MAX_ACTIVE_DOCUMENTS: int = 30
    FREE_MAX_API_KEYS: int = 2
    PRO_MAX_ACTIVE_DOCUMENTS: int = 1000
    PRO_MAX_API_KEYS: int = 10

    # The Pro price shown on the pricing page, in PRICE_CURRENCY (ISO 4217).
    # What is charged is the Stripe price (STRIPE_PRICE_ID_PRO); keep the two in step.
    PRICE_CURRENCY: str = "BRL"
    PRO_PRICE_MONTHLY: float = 19

    # Internal Node service that runs @docforge-lib/layout (packages/layout-service).
    LAYOUT_SERVICE_URL: str = "http://127.0.0.1:8002"
    LAYOUT_SERVICE_TIMEOUT_SECONDS: float = 15.0

    # Version retention (Free plan): oldest inactive versions beyond this count
    # are pruned when a new one is created. None/0 on paid plans (see tiers.py).
    FREE_MAX_VERSIONS_PER_SECTION: int = 50

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

    model_config = {"env_file": ENV_FILE, "extra": "ignore"}


settings = Settings()
