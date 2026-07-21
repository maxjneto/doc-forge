"""Thin async HTTP client wrapping the DocForge REST API."""

from __future__ import annotations

import os
from contextvars import ContextVar
from typing import Any

import httpx

# Set by HTTP middleware for each incoming request.
_api_key_var: ContextVar[str] = ContextVar("docforge_api_key", default="")

API_BASE = os.environ.get("DOCFORGE_API_BASE", "http://localhost:8000/api")
FRONTEND_BASE = os.environ.get("DOCFORGE_FRONTEND_BASE", "http://localhost:5173")


class DocForgeError(Exception):
    pass


def _client() -> httpx.AsyncClient:
    key = _api_key_var.get()
    if not key:
        raise DocForgeError("No API key found. Send an X-API-Key header with the request.")
    return httpx.AsyncClient(
        base_url=API_BASE,
        headers={"X-API-Key": key},
        timeout=30.0,
    )


async def _get(path: str, **params: Any) -> Any:
    async with _client() as c:
        r = await c.get(path, params=params or None)
    if not r.is_success:
        raise DocForgeError(f"GET {path} failed ({r.status_code}): {r.text}")
    return r.json()


async def _post(path: str, json: Any = None) -> Any:
    async with _client() as c:
        r = await c.post(path, json=json)
    if not r.is_success:
        raise DocForgeError(f"POST {path} failed ({r.status_code}): {r.text}")
    return r.json()


async def _patch(path: str, json: Any) -> Any:
    async with _client() as c:
        r = await c.patch(path, json=json)
    if not r.is_success:
        raise DocForgeError(f"PATCH {path} failed ({r.status_code}): {r.text}")
    return r.json()


# ─── API wrappers ────────────────────────────────────────────

async def get_user_info() -> dict[str, Any]:
    return await _get("/users/me")


async def list_documents() -> list[dict[str, Any]]:
    data = await _get("/documents")
    return data.get("documents", []) if isinstance(data, dict) else data


async def create_document(title: str, context: str = "") -> dict[str, Any]:
    return await _post("/documents", json={
        "title": title,
        "document_context": context or None,
        "mode": "editor",
    })


async def get_document(document_id: str) -> dict[str, Any]:
    data = await _get(f"/documents/{document_id}")
    if isinstance(data, dict) and "document" in data:
        return {**data["document"], "sections": data.get("sections", [])}
    return data


async def update_section_content(section_id: str, content: str, note: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"content": content}
    if note:
        body["note"] = note
    return await _patch(f"/sections/{section_id}/content", json=body)


async def create_version_snapshot(
    section_id: str,
    version_name: str | None = None,
    change_summary: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if version_name:
        body["version_name"] = version_name
    if change_summary:
        body["change_summary"] = change_summary
    return await _post(f"/sections/{section_id}/versions/snapshot", json=body or None)


async def list_versions(section_id: str) -> list[dict[str, Any]]:
    return await _get(f"/sections/{section_id}/versions")


async def restore_version(section_id: str, version_id: str) -> dict[str, Any]:
    return await _post(f"/sections/{section_id}/versions/{version_id}/restore")


async def update_section_version(
    section_id: str,
    version_id: str,
    version_name: str | None = None,
    change_summary: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if version_name is not None:
        body["version_name"] = version_name
    if change_summary is not None:
        body["change_summary"] = change_summary
    return await _patch(f"/sections/{section_id}/versions/{version_id}", json=body)


async def get_activity(document_id: str, limit: int = 50) -> list[dict[str, Any]]:
    return await _get(f"/documents/{document_id}/activity", limit=limit)


# ─── Suggestions & feedback (trust layer) ────────────────────

async def list_suggestions(
    document_id: str,
    status: str | None = None,
    include_content: bool = False,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"include_content": include_content}
    if status:
        params["status"] = status
    data = await _get(f"/documents/{document_id}/suggestions", **params)
    return data.get("suggestions", []) if isinstance(data, dict) else data


async def get_suggestion(suggestion_id: str) -> dict[str, Any]:
    return await _get(f"/suggestions/{suggestion_id}")


async def list_feedback(document_id: str, status: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    if status:
        params["status"] = status
    data = await _get(f"/documents/{document_id}/feedback", **params)
    return data.get("feedback", []) if isinstance(data, dict) else data


async def resolve_feedback(
    feedback_id: str,
    resolution_note: str | None = None,
    status: str = "resolved",
) -> dict[str, Any]:
    return await _post(f"/feedback/{feedback_id}/resolve", json={
        "resolution_note": resolution_note,
        "status": status,
    })


# ─── Document types & pipeline (BYOA) ────────────────────────

async def list_document_types() -> list[dict[str, Any]]:
    return await _get("/document-types")


async def start_pipeline(
    document_type_slug: str,
    title: str | None,
    document_context: str,
    pipeline_definition_id: str | None = None,
) -> dict[str, Any]:
    return await _post("/pipeline/documents", json={
        "document_type_slug": document_type_slug,
        "title": title,
        "document_context": document_context,
        "pipeline_definition_id": pipeline_definition_id,
    })


async def list_pipeline_definitions() -> list[dict[str, Any]]:
    return await _get("/pipeline-definitions")


# ─── Quality gate ────────────────────────────────────────────

async def get_gate_status(document_id: str) -> dict[str, Any]:
    return await _get(f"/documents/{document_id}/quality-gate")


async def get_sections_for_gate(document_id: str) -> dict[str, Any]:
    return await _get(f"/documents/{document_id}/sections-for-gate")


async def submit_quality_findings(document_id: str, findings: list[dict]) -> Any:
    return await _post(
        f"/documents/{document_id}/quality-gate/findings",
        json={"findings": findings},
    )


async def get_next_step(document_id: str) -> dict[str, Any]:
    return await _get(f"/documents/{document_id}/pipeline/next-step")


async def submit_step(document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return await _post(f"/documents/{document_id}/pipeline/submit", json={"payload": payload})


def document_url(document_id: str) -> str:
    return f"{FRONTEND_BASE}/document/{document_id}"
