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
    """An empty layout document: an A4 surface and a continuous one, no components."""
    return {
        "format": FORMAT,
        "version": 2,
        "meta": {"title": title},
        "surfaces": [
            {"id": "a4", "kind": "page", "size": "A4", "margin": 40},
            {"id": "continuous", "kind": "continuous", "width": 820, "margin": 40},
        ],
        "components": [],
    }


def _map_options(pages: list[int] | None, draw: bool | None) -> dict[str, Any]:
    options: dict[str, Any] = {}
    if pages:
        options["pages"] = pages
    if draw is not None:
        options["draw"] = draw
    return options


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
    """{ok, diagnostics, map, pages} — ok is false only when the document cannot be
    used (invalid schema, duplicate ids). Layout problems are diagnostics."""
    return await _call("/validate", {"doc": doc})


async def apply(
    doc: dict[str, Any],
    ops: list[dict[str, Any]],
    pages: list[int] | None = None,
    draw: bool | None = None,
) -> dict[str, Any]:
    """{ok, doc, diagnostics, changes, map, summary} — nothing is stored by the service:
    `doc` is the result, worth saving when ok; `changes` are the side effects."""
    return await _call("/apply", {"doc": doc, "ops": ops, **_map_options(pages, draw)})


async def document_map(
    doc: dict[str, Any],
    level: int,
    components: list[str] | None = None,
    pages: list[int] | None = None,
    draw: bool | None = None,
) -> dict[str, Any]:
    """{level, text} — the text map an agent reads instead of looking at the page."""
    body: dict[str, Any] = {"doc": doc, "level": level, **_map_options(pages, draw)}
    if components:
        body["components"] = components
    return await _call("/map", body)


async def diff(before: dict[str, Any], after: dict[str, Any], touched: list[str]) -> list[dict[str, Any]]:
    """Side effects of going from `before` to `after`, leaving out `touched` components."""
    return (await _call("/diff", {"before": before, "after": after, "touched": touched}))["changes"]


async def measure(
    component: dict[str, Any],
    doc: dict[str, Any] | None = None,
    widths: list[int] | None = None,
    cols: list[list[int]] | None = None,
) -> dict[str, Any]:
    """{ok, measurements, diagnostics, text} — a component's size, without placing it."""
    body: dict[str, Any] = {"component": component}
    if doc is not None:
        body["doc"] = doc
    if widths:
        body["widths"] = widths
    if cols:
        body["cols"] = cols
    return await _call("/measure", body)


async def find(doc: dict[str, Any], query: dict[str, Any]) -> dict[str, Any]:
    """{matches, text} — components matching every filter in `query`."""
    return await _call("/find", {"doc": doc, "query": query})


async def calibrate(doc: dict[str, Any], target: dict[str, str], variants: list[dict[str, Any]]) -> dict[str, Any]:
    """{ok, variants, text} — style variants measured side by side; none is applied."""
    return await _call("/calibrate", {"doc": doc, "target": target, "variants": variants})


async def render_image(doc: dict[str, Any], page: int, scale: float, highlight: list[str] | None = None) -> dict[str, Any]:
    """{page, pages, png (base64) | null, width?, height?} — one page drawn as a PNG by
    the service (SVG + resvg, no browser). `png` is null when the service has no rasterizer."""
    body: dict[str, Any] = {"doc": doc, "page": page, "scale": scale}
    if highlight:
        body["highlight"] = highlight
    return await _call("/render-image", body)


async def review(doc: dict[str, Any]) -> dict[str, Any]:
    """{findings, text} — composition findings (empty boxes, ragged rows, edges off
    the guides, a near-empty last page), each with the ops that fix it."""
    return await _call("/review", {"doc": doc})


async def locate(doc: dict[str, Any], anchors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Where each note anchor is now and what is drawn there: [{component?, under, text}]."""
    return (await _call("/locate", {"doc": doc, "anchors": anchors}))["anchors"]
