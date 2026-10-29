import time

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
from app.services.observability import capture_account_event

setup_logging()

app = FastAPI(title="DocForge API", version="0.1.0")

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
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "[res] {} {} | status={} elapsed={:.1f}ms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    # Every call an agent makes (API key auth) is a usage data point: which route,
    # how it went, how long it took. The route template, not the path, so ids do
    # not split the counts. Telemetry posts are left out (they would count twice).
    user_id = getattr(request.state, "user_id", None)
    route = getattr(request.scope.get("route"), "path", None)
    if user_id and getattr(request.state, "api_key_id", None) and route and "/telemetry/" not in route:
        capture_account_event(
            user_id,
            "mcp_api_request",
            {
                "route": f"{request.method} {route}",
                "status": response.status_code,
                "ok": response.status_code < 400,
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
