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


def _failure(method: str, path: str, r: httpx.Response) -> DocForgeError:
    """Prefer the API's own message (and code) over a raw response body."""
    try:
        detail: Any = r.json().get("detail")
    except (ValueError, AttributeError):
        detail = None
    prefix = f"{method} {path} failed ({r.status_code})"
    if isinstance(detail, dict) and detail.get("message"):
        code = f" [{detail['code']}]" if detail.get("code") else ""
        problems = "".join(
            f"\n- [{d.get('severity')}] {d.get('code')}: {d.get('message')}"
            for d in detail.get("diagnostics") or []
        )
        return DocForgeError(f"{prefix}{code}: {detail['message']}{problems}")
    if isinstance(detail, str):
        return DocForgeError(f"{prefix}: {detail}")
    return DocForgeError(f"{prefix}: {r.text}")


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
        raise _failure("GET", path, r)
    return r.json()


async def _post(path: str, json: Any = None) -> Any:
    async with _client() as c:
        r = await c.post(path, json=json)
    if not r.is_success:
        raise _failure("POST", path, r)
    return r.json()


async def _put(path: str, json: Any) -> Any:
    async with _client() as c:
        r = await c.put(path, json=json)
    if not r.is_success:
        raise _failure("PUT", path, r)
    return r.json()


async def _patch(path: str, json: Any) -> Any:
    async with _client() as c:
        r = await c.patch(path, json=json)
    if not r.is_success:
        raise _failure("PATCH", path, r)
    return r.json()


# ─── API wrappers ────────────────────────────────────────────

async def get_user_info() -> dict[str, Any]:
    return await _get("/users/me")


async def list_documents() -> list[dict[str, Any]]:
    data = await _get("/documents")
    return data.get("documents", []) if isinstance(data, dict) else data


async def create_document(title: str) -> dict[str, Any]:
    return await _post("/documents", json={"title": title})


async def get_document(document_id: str) -> dict[str, Any]:
    data = await _get(f"/documents/{document_id}")
    if isinstance(data, dict) and "document" in data:
        return {**data["document"], "sections": data.get("sections", [])}
    return data


async def update_section_content(
    section_id: str, content: str, note: str | None = None, mode: str = "replace"
) -> dict[str, Any]:
    body: dict[str, Any] = {"content": content, "mode": mode}
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


async def reply_feedback(feedback_id: str, content: str) -> dict[str, Any]:
    return await _post(f"/feedback/{feedback_id}/replies", json={"content": content})


async def resolve_feedback(
    feedback_id: str,
    resolution_note: str | None = None,
    status: str = "resolved",
) -> dict[str, Any]:
    return await _post(f"/feedback/{feedback_id}/resolve", json={
        "resolution_note": resolution_note,
        "status": status,
    })


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


def document_url(document_id: str) -> str:
    return f"{FRONTEND_BASE}/document/{document_id}"


# ─── Layout documents ─────────────────────────────────────────

async def create_layout_document(
    title: str, content: dict[str, Any] | None = None, template: str | None = None, fmt: str | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"title": title}
    if content is not None:
        body["content"] = content
    if template:
        body["template"] = template
    if fmt:
        body["format"] = fmt
    return await _post("/layout-documents", json=body)


async def get_layout(document_id: str) -> dict[str, Any]:
    return await _get(f"/documents/{document_id}/layout")


async def get_layout_map(
    document_id: str,
    level: int = 1,
    components: list[str] | None = None,
    pages: list[int] | None = None,
    draw: bool = True,
) -> dict[str, Any]:
    params: dict[str, Any] = {"level": level}
    if components:
        params["components"] = ",".join(components)
    if pages:
        params["pages"] = ",".join(str(p) for p in pages)
    if not draw:
        params["draw"] = "false"
    return await _get(f"/documents/{document_id}/layout/map", **params)


async def apply_layout_ops(
    document_id: str,
    ops: list[dict[str, Any]],
    base_revision: int | None = None,
    pages: list[int] | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"ops": ops}
    if base_revision is not None:
        body["base_revision"] = base_revision
    if pages:
        body["pages"] = pages
    if note:
        body["note"] = note
    return await _post(f"/documents/{document_id}/layout/ops", json=body)


async def request_layout_review(
    document_id: str, summary: str, focus: list[str], questions: list[dict[str, Any]]
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "message": summary,
        "code": "review-request",
        "review": {"focus": focus, "questions": questions},
    }
    if focus:
        body["anchor"] = {"component": focus[0]}
    return await _post(f"/documents/{document_id}/layout/notes", json=body)


async def preview_layout_ops(document_id: str, ops: list[dict[str, Any]], pages: list[int] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"ops": ops}
    if pages:
        body["pages"] = pages
    return await _post(f"/documents/{document_id}/layout/preview", json=body)


async def preview_layout_document(
    content: dict[str, Any], ops: list[dict[str, Any]] | None = None, pages: list[int] | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"content": content}
    if ops:
        body["ops"] = ops
    if pages:
        body["pages"] = pages
    return await _post("/layout/preview", json=body)


async def measure_layout_component(
    component: dict[str, Any],
    widths: list[int] | None = None,
    cols: list[list[int]] | None = None,
    document_id: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"component": component}
    if widths:
        body["widths"] = widths
    if cols:
        body["cols"] = cols
    if document_id:
        body["document_id"] = document_id
    return await _post("/layout/measure", json=body)


async def render_layout_page(document_id: str, page: int, scale: float, highlight: list[str] | None) -> dict[str, Any]:
    params: dict[str, Any] = {"page": page, "scale": scale}
    if highlight:
        params["highlight"] = ",".join(highlight)
    return await _get(f"/documents/{document_id}/layout/image", **params)


async def report_tool_call(payload: dict[str, Any]) -> None:
    """Usage telemetry (which tool, how long, how much text the agent got). Best effort:
    a failure here must never reach the agent."""
    try:
        await _post("/telemetry/mcp-tool", json=payload)
    except Exception:  # noqa: BLE001 — telemetry is never worth an error
        pass


async def review_layout(document_id: str) -> dict[str, Any]:
    return await _get(f"/documents/{document_id}/layout/review")


async def find_in_layout(
    document_id: str,
    text: str | None = None,
    types: list[str] | None = None,
    label: str | None = None,
    page: int | None = None,
    rect: dict[str, int] | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if text:
        params["text"] = text
    if types:
        params["type"] = ",".join(types)
    if label:
        params["label"] = label
    if page is not None:
        params["page"] = page
    if rect:
        params["rect"] = ",".join(str(rect.get(k, 0)) for k in ("page", "x", "y", "w", "h"))
    if state:
        params["state"] = state
    return await _get(f"/documents/{document_id}/layout/find", **params)


async def calibrate_layout_style(document_id: str, target: dict[str, str], variants: list[dict[str, Any]]) -> dict[str, Any]:
    return await _post(f"/documents/{document_id}/layout/calibrate", json={**target, "variants": variants})


async def list_layout_notes(
    document_id: str, status: str = "open", kind: str | None = None, component: str | None = None
) -> dict[str, Any]:
    params: dict[str, Any] = {"status": status}
    if kind:
        params["kind"] = kind
    if component:
        params["component"] = component
    return await _get(f"/documents/{document_id}/layout/notes", **params)


async def update_layout_note(note_id: str, status: str, resolution_note: str | None = None) -> dict[str, Any]:
    return await _patch(f"/layout-notes/{note_id}", {"status": status, "resolution_note": resolution_note})


async def reply_layout_note(document_id: str, note_id: str, message: str) -> dict[str, Any]:
    return await _post(f"/documents/{document_id}/layout/notes", json={"message": message, "parent_id": note_id})


async def list_layout_themes() -> dict[str, Any]:
    return await _get("/layout-themes")


async def save_layout_theme(name: str, tokens: dict[str, Any], description: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"name": name, "tokens": tokens}
    if description:
        body["description"] = description
    return await _post("/layout-themes", json=body)


async def apply_layout_theme(document_id: str, theme: str) -> dict[str, Any]:
    return await _post(f"/documents/{document_id}/layout/theme", json={"theme": theme})


async def save_layout_version(document_id: str, name: str, note: str | None = None, revision: int | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"name": name}
    if note:
        body["note"] = note
    if revision is not None:
        body["revision"] = revision
    return await _post(f"/documents/{document_id}/layout/versions", json=body)


async def list_layout_revisions(document_id: str, named: bool = False, limit: int = 30) -> dict[str, Any]:
    params: dict[str, Any] = {"limit": limit}
    if named:
        params["named"] = "true"
    return await _get(f"/documents/{document_id}/layout/revisions", **params)


async def get_layout_revision(document_id: str, revision: int) -> dict[str, Any]:
    return await _get(f"/documents/{document_id}/layout/revisions/{revision}")


async def replace_layout(
    document_id: str, content: dict[str, Any], base_revision: int | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"content": content}
    if base_revision is not None:
        body["base_revision"] = base_revision
    return await _put(f"/documents/{document_id}/layout", json=body)


# ─── Artifacts ────────────────────────────────────────────────────


async def list_artifacts(document_id: str) -> list[dict[str, Any]]:
    data = await _get(f"/documents/{document_id}/artifacts")
    return data.get("artifacts", [])


async def create_artifact(
    document_id: str, key: str, kind: str, title: str, content: str
) -> dict[str, Any]:
    return await _post(
        f"/documents/{document_id}/artifacts",
        {"key": key, "kind": kind, "title": title, "content": content},
    )
