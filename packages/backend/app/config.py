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
    INNGEST_EVENT_KEY: str = ""
    INNGEST_SIGNING_KEY: str = ""
    INNGEST_DEV_SERVER_URL: str = "http://127.0.0.1:8288"
    IS_PRODUCTION: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    CLERK_JWKS_URL: str = ""

    model_config = {"env_file": ENV_FILE, "extra": "ignore"}


settings = Settings()
