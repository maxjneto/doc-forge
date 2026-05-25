"""DocForge MCP server — tools and resources for AI agents.

Transport: Streamable HTTP. Clients connect to the hosted server and
authenticate with an X-API-Key header per request.
"""

from __future__ import annotations

import json
import os
from typing import Any

from mcp.server.fastmcp import FastMCP
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

import docforge_mcp.client as api
from docforge_mcp.client import DocForgeError, _api_key_var
from docforge_mcp.resources.loader import list_recipes, read_resource

mcp = FastMCP("docforge")


# ─── Helpers ────────────────────────────────────────────────

def _json(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str)


async def _resolve_body_section(document_id: str) -> tuple[dict, str]:
    doc = await api.get_document(document_id)
    sections = doc.get("sections", [])
    body = next((s for s in sections if s.get("section_type") == "body"), None)
    if body is None:
        raise DocForgeError(f"Document {document_id} has no body section.")
    return doc, body["id"]


# ─── Tools ──────────────────────────────────────────────────

@mcp.tool()
async def get_user_info() -> str:
    """Get the current user's info: name, email, credits, weekly_credits.
    Call this before create_document to confirm the user has enough credits."""
    data = await api.get_user_info()
    return (
        f"Name: {data.get('name') or '(no name)'}\n"
        f"Email: {data.get('email')}\n"
        f"Credits: {data.get('credits')} (weekly allowance: {data.get('weekly_credits')})"
    )


@mcp.tool()
async def list_documents() -> str:
    """List all DocForge editor documents belonging to the current user."""
    docs = await api.list_documents()
    if not docs:
        return "No documents found."
    lines = [f"- [{d['title']}] id={d['id']} updated={d.get('updated_at', '')[:10]}" for d in docs]
    return "\n".join(lines)


@mcp.tool()
async def create_document(title: str, context: str = "") -> str:
    """Create a new DocForge editor document. Costs 1 credit — call get_user_info first.
    Returns the document id, title, and browser URL.

    Args:
        title: Document title.
        context: Optional short description of what this document is for.
    """
    doc = await api.create_document(title, context)
    url = api.document_url(doc["id"])
    return (
        f"Document created.\n"
        f"Title: {doc['title']}\n"
        f"ID: {doc['id']}\n"
        f"URL: {url}\n\n"
        f"Share this URL with the user so they can follow along in real-time."
    )


@mcp.tool()
async def get_document(document_id: str) -> str:
    """Read a document's metadata and current body section content.
    Always call this before write_section to see what's already there.

    Args:
        document_id: Document UUID.
    """
    doc = await api.get_document(document_id)
    sections = doc.get("sections", [])
    body = next((s for s in sections if s.get("section_type") == "body"), None)
    content = body.get("active_version_content") or "" if body else ""
    return (
        f"Title: {doc['title']}\n"
        f"ID: {doc['id']}\n"
        f"Phase: {doc.get('current_phase')}\n"
        f"Content ({len(content)} chars):\n\n{content}"
    )


@mcp.tool()
async def write_section(document_id: str, content: str, note: str = "") -> str:
    """Replace the full body section content of a document.
    To append, read the current content via get_document first, then compose and write.
    Content appears in the user's browser in real-time via SSE.

    Args:
        document_id: Document UUID.
        content: Full Markdown content to write.
        note: Optional explanation stored in the activity log (e.g. 'Analyzed 47 source files').
    """
    doc, section_id = await _resolve_body_section(document_id)
    await api.update_section_content(section_id, content, note or None)
    return (
        f"Written {len(content)} characters to '{doc['title']}'. "
        f"The user's browser has been updated in real-time."
    )


@mcp.tool()
async def snapshot_section(
    document_id: str,
    version_name: str = "",
    change_summary: str = "",
) -> str:
    """Save a named version checkpoint for the body section.
    Use before and after large rewrites so both states are preserved.

    Args:
        document_id: Document UUID.
        version_name: Short label for this snapshot (e.g. 'Initial draft').
        change_summary: Optional longer description of what changed.
    """
    doc, section_id = await _resolve_body_section(document_id)
    version = await api.create_version_snapshot(
        section_id,
        version_name or None,
        change_summary or None,
    )
    return (
        f"Snapshot saved for '{doc['title']}'.\n"
        f"Version: {version.get('version_name')}\n"
        f"ID: {version.get('id')}"
    )


@mcp.tool()
async def list_versions(document_id: str) -> str:
    """List version history for the body section.
    Check this before a major write to see who last edited the document.

    Args:
        document_id: Document UUID.
    """
    doc, section_id = await _resolve_body_section(document_id)
    versions = await api.list_versions(section_id)
    if not versions:
        return "No versions found."
    lines = []
    for v in versions:
        active = " [ACTIVE]" if v.get("is_active") else ""
        lines.append(
            f"- {v.get('version_name')} id={v['id']}{active} "
            f"created={v.get('created_at', '')[:16]}"
        )
    return f"Versions for '{doc['title']}':\n" + "\n".join(lines)


@mcp.tool()
async def select_active_version(document_id: str, version_id: str) -> str:
    """Switch the active (displayed) version of the body section.
    The user sees the new version in their browser instantly.
    Use list_versions to find version IDs.

    Args:
        document_id: Document UUID.
        version_id: Version UUID to make active.
    """
    doc, section_id = await _resolve_body_section(document_id)
    await api.restore_version(section_id, version_id)
    return (
        f"Version {version_id} is now active for '{doc['title']}'. "
        f"The user's browser has been updated."
    )


@mcp.tool()
async def get_version_content(document_id: str, version_id: str) -> str:
    """Read the full content of a specific (possibly inactive) version of the body section.
    Use this to diff or preview a version before calling select_active_version.

    Args:
        document_id: Document UUID.
        version_id: Version UUID. Obtain via list_versions.
    """
    doc, section_id = await _resolve_body_section(document_id)
    versions = await api.list_versions(section_id)
    version = next((v for v in versions if v.get("id") == version_id), None)
    if version is None:
        raise DocForgeError(f"Version {version_id} not found for document {document_id}.")
    content = version.get("content") or ""
    active = " [ACTIVE]" if version.get("is_active") else ""
    return (
        f"Version: {version.get('version_name')}{active}\n"
        f"ID: {version.get('id')}\n"
        f"Created: {version.get('created_at', '')[:16]}\n"
        f"Summary: {version.get('change_summary') or '(none)'}\n"
        f"Content ({len(content)} chars):\n\n{content}"
    )


@mcp.tool()
async def rename_version(
    document_id: str,
    version_id: str,
    version_name: str = "",
    change_summary: str = "",
) -> str:
    """Update the name and/or change summary of an existing version.
    At least one of version_name or change_summary must be provided.

    Args:
        document_id: Document UUID.
        version_id: Version UUID.
        version_name: New label for the version (omit to keep current).
        change_summary: New description (omit to keep current; empty string clears it).
    """
    if not version_name and not change_summary:
        raise DocForgeError("Provide at least one of version_name or change_summary.")
    doc, section_id = await _resolve_body_section(document_id)
    updated = await api.update_section_version(
        section_id,
        version_id,
        version_name=version_name or None,
        change_summary=change_summary or None,
    )
    return (
        f"Updated version for '{doc['title']}'.\n"
        f"Name: {updated.get('version_name')}\n"
        f"Summary: {updated.get('change_summary') or '(none)'}"
    )


@mcp.tool()
async def get_activity(document_id: str, limit: int = 20) -> str:
    """List recent activity (writes, snapshots, version switches) for a document.
    Use this to see what other actors (humans or other agents) have done.

    Args:
        document_id: Document UUID.
        limit: Maximum number of entries to return (default 20, max 50).
    """
    entries = await api.get_activity(document_id, limit=min(limit, 50))
    if not entries:
        return "No activity yet."
    lines = []
    for e in entries:
        ts = (e.get("created_at") or "")[:16]
        actor = e.get("actor_name") or "Unknown"
        marker = " [agent]" if e.get("is_agent") else ""
        desc = e.get("description") or e.get("action_type") or ""
        lines.append(f"- {ts} {actor}{marker}: {desc}")
    return "\n".join(lines)


@mcp.tool()
async def get_document_url(document_id: str) -> str:
    """Return the browser URL for a document so the user can open it and follow along.

    Args:
        document_id: Document UUID.
    """
    return api.document_url(document_id)


# ─── Resources ───────────────────────────────────────────────

@mcp.resource("docforge://documents")
async def resource_list_documents() -> str:
    """JSON list of all your DocForge editor documents."""
    docs = await api.list_documents()
    return _json(docs)


@mcp.resource("docforge://document/{document_id}")
async def resource_get_document(document_id: str) -> str:
    """Current body content of the document as Markdown."""
    doc = await api.get_document(document_id)
    sections = doc.get("sections", [])
    body = next((s for s in sections if s.get("section_type") == "body"), None)
    content = body.get("active_version_content") or "" if body else ""
    return f"---\ntitle: {doc['title']}\nid: {doc['id']}\n---\n\n{content}"


@mcp.resource("docforge://document/{document_id}/versions")
async def resource_list_versions(document_id: str) -> str:
    """JSON version history for the body section."""
    _, section_id = await _resolve_body_section(document_id)
    versions = await api.list_versions(section_id)
    return _json(versions)


@mcp.resource("docforge://guide/system-prompt")
async def resource_system_prompt() -> str:
    """Orientation brief: how to operate on DocForge documents via MCP."""
    return read_resource("guide", "system_prompt.md")


@mcp.resource("docforge://recipes")
async def resource_list_recipes() -> str:
    """JSON index of available workflow recipe slugs."""
    return _json([
        {"slug": slug, "uri": f"docforge://recipes/{slug}"}
        for slug in list_recipes()
    ])


@mcp.resource("docforge://recipes/{workflow}")
async def resource_recipe(workflow: str) -> str:
    """Procedural recipe for a named workflow (e.g. 'safe-rewrite')."""
    filename = f"{workflow.replace('-', '_')}.md"
    try:
        return read_resource("recipes", filename)
    except (FileNotFoundError, ModuleNotFoundError):
        available = ", ".join(list_recipes())
        raise DocForgeError(f"Recipe '{workflow}' not found. Available: {available}.")


# ─── Prompts ─────────────────────────────────────────────────

@mcp.prompt()
async def docforge_orientation() -> str:
    """Agent orientation brief — surfaces via prompts/list so MCP clients can inject it
    automatically, without the agent needing to know the resource URI."""
    return read_resource("guide", "system_prompt.md")


# ─── HTTP middleware (extracts X-API-Key per request) ────────

class _ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        key = request.headers.get("x-api-key", "")
        token = _api_key_var.set(key)
        try:
            return await call_next(request)
        finally:
            _api_key_var.reset(token)


# ─── Entry point ─────────────────────────────────────────────

def serve() -> None:
    """Streamable HTTP transport — for hosted/production deployment.

    Set environment variables:
      HOST                  bind address (default: 0.0.0.0)
      PORT                  port (default: 8001)
      DOCFORGE_API_BASE     DocForge backend URL
      DOCFORGE_FRONTEND_BASE  DocForge frontend URL (for document URLs returned to agents)
    """
    import uvicorn

    base_app = mcp.streamable_http_app()
    app = _ApiKeyMiddleware(app=base_app)

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    serve()
