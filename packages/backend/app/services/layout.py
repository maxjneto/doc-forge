"""Client for the internal layout service (packages/layout-service).

The backend cannot run @docforge/layout (TypeScript), so measuring, validating
and applying operations happen in that Node process. This module is the only
place that talks to it; every failure to reach it becomes a 503 so a caller
never mistakes "the service is down" for "the document is invalid".
"""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status
from loguru import logger

from app.config import settings

FORMAT = "docforge/layout"


def starter_document(title: str) -> dict[str, Any]:
    """An empty layout document: an A4 surface, a continuous one, one empty section."""
    return {
        "format": FORMAT,
        "version": 1,
        "meta": {"title": title},
        "surfaces": [
            {"id": "a4", "kind": "page", "size": "A4", "margin": 40},
            {"id": "continuous", "kind": "continuous", "width": 820, "margin": 40},
        ],
        "sections": [{"id": "s-1", "bands": []}],
        "components": [],
    }


async def _call(path: str, body: dict[str, Any]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(
            base_url=settings.LAYOUT_SERVICE_URL,
            timeout=settings.LAYOUT_SERVICE_TIMEOUT_SECONDS,
        ) as client:
            res = await client.post(path, json=body)
    except httpx.HTTPError as e:
        logger.error("[layout] service unreachable | path={} error={}", path, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The layout service is unavailable. Try again shortly.",
        ) from e

    if res.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE:
        raise HTTPException(status_code=413, detail="The layout document is too large.")
    if res.status_code == status.HTTP_400_BAD_REQUEST:
        raise HTTPException(status_code=422, detail=res.json().get("error", "Invalid layout request."))
    if not res.is_success:
        logger.error("[layout] service error | path={} status={} body={}", path, res.status_code, res.text[:500])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The layout service failed to process the document.",
        )
    return res.json()


async def validate(doc: dict[str, Any]) -> dict[str, Any]:
    """{ok, diagnostics, map, pages} — ok means no error-level diagnostic."""
    return await _call("/validate", {"doc": doc})


async def apply(doc: dict[str, Any], ops: list[dict[str, Any]]) -> dict[str, Any]:
    """{ok, doc, diagnostics, map} — `doc` is the result, only worth saving when ok."""
    return await _call("/apply", {"doc": doc, "ops": ops})


async def document_map(doc: dict[str, Any], level: int, components: list[str] | None = None) -> dict[str, Any]:
    """{level, text} — the text map an agent reads instead of looking at the page."""
    body: dict[str, Any] = {"doc": doc, "level": level}
    if components:
        body["components"] = components
    return await _call("/map", body)
