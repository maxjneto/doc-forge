import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.logging_config import setup_logging
from app.routers import (
    artifacts,
    billing,
    documents,
    layout,
    organization,
    quality_gate,
    sections,
    suggestions,
    telemetry,
)
from app.routers import users as users_router
from app.services import observability
from app.services.observability import capture_account_event

setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    observability.shutdown()


app = FastAPI(title="DocForge API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    logger.info(
        "[req] {} {} | client={}",
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
    )
    try:
        response = await call_next(request)
    except Exception as exc:
        route = getattr(request.scope.get("route"), "path", None)
        observability.capture_exception(exc, {"route": f"{request.method} {route or request.url.path}"})
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "[res] {} {} | status={} elapsed={:.1f}ms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    # An agent call (API key auth) that failed: which route and how. Successful calls
    # are already counted per tool by the MCP server (mcp_tool_called), so only the
    # failures are sent. The route template, not the path, so ids do not split counts.
    user = getattr(request.state, "user", None)
    route = getattr(request.scope.get("route"), "path", None)
    if (
        user is not None
        and getattr(request.state, "api_key_id", None)
        and route
        and "/telemetry/" not in route
        and response.status_code >= 400
    ):
        capture_account_event(
            user,
            "agent_request_failed",
            {
                "route": f"{request.method} {route}",
                "status": response.status_code,
                "duration_ms": round(elapsed_ms, 1),
            },
        )
    return response

app.include_router(documents.router, prefix="/api")
app.include_router(sections.router, prefix="/api")
app.include_router(suggestions.router, prefix="/api")
app.include_router(quality_gate.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(users_router.router, prefix="/api")
app.include_router(artifacts.router, prefix="/api")
app.include_router(organization.router, prefix="/api")
app.include_router(layout.router, prefix="/api")
app.include_router(telemetry.router, prefix="/api")

# Served at both paths: /health for container checks inside the network, /api/health
# for checks from outside, since the proxy only forwards /api/* to the backend.
@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok"}
