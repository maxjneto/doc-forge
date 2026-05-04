from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import inngest.fast_api
from loguru import logger

from app.logging_config import setup_logging
from app.config import settings
from app.inngest_client import inngest_client
from app.routers import documents, sections
from app.workflows.orchestrator import ALL_FUNCTIONS

setup_logging()

app = FastAPI(title="DocForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/api")
app.include_router(sections.router, prefix="/api")

inngest.fast_api.serve(app, inngest_client, ALL_FUNCTIONS)


@app.get("/health")
async def health():
    logger.debug("Health check")
    return {"status": "ok"}
