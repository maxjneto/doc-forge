"""DocForge MCP server — tools and resources for AI agents.

Transport: Streamable HTTP. Clients connect to the hosted server and
authenticate with an `Authorization: Bearer <api-key>` header on every
request. Each tool/resource reads its own header via ctx.request_context
(see _use_api_key) rather than an ASGI middleware — required because a
session's messages all run in one long-lived task past the first request.
"""

from __future__ import annotations

import asyncio
import base64
import functools
import json
import os
import re
import time
from typing import Any

from mcp.server.fastmcp import Context, FastMCP, Image
from mcp.server.transport_security import TransportSecuritySettings

import docforge_mcp.client as api
from docforge_mcp.client import DocForgeError, _api_key_var
from docforge_mcp.resources.loader import (
    list_recipes,
    list_writing_guides,
    read_resource,
)

# DNS rebinding protection is handled by Cloudflare in production; disable the
# built-in check so requests with custom Host headers (mcp.docforge.dev) are
# accepted without needing to be in an allowlist.
mcp = FastMCP(
    "docforge",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


# ─── Usage telemetry ────────────────────────────────────────
#
# Every tool reports, after it runs: its name, whether it worked, how long it took
# and how many characters it handed the agent (≈ tokens × 4). The report goes to
# the backend with the agent's own key (so it lands on the right person) in a
# background task: it never delays or fails a tool. DOCFORGE_TELEMETRY=off stops it.

_TELEMETRY = os.environ.get("DOCFORGE_TELEMETRY", "on").lower() not in ("off", "0", "false")
_pending: set[asyncio.Task] = set()


def _content_size(result: Any) -> tuple[int, int]:
    """(characters of text, bytes of images) in a tool result."""
    if isinstance(result, str):
        return len(result), 0
    if isinstance(result, Image):
        return 0, len(result.data or b"")
    if isinstance(result, (list, tuple)):
        chars = images = 0
        for item in result:
            c, i = _content_size(item)
            chars, images = chars + c, images + i
        return chars, images
    return len(json.dumps(result, default=str)), 0


def _detail(kwargs: dict[str, Any]) -> dict[str, Any]:
    """A few arguments worth slicing usage by, never content."""
    out: dict[str, Any] = {}
    for key in ("map", "template", "level", "scale", "page"):
        value = kwargs.get(key)
        if isinstance(value, (str, int, float, bool)) and value != "":
            out[key] = value
    ops = kwargs.get("ops")
    if isinstance(ops, list):
        out["ops"] = len(ops)
    return out


def _tool(*dargs: Any, **dkwargs: Any):
    """`mcp.tool`, plus a usage report after each call."""
    register = _register_tool(*dargs, **dkwargs)

    def wrap(fn):
        @functools.wraps(fn)
        async def run(*args: Any, **kwargs: Any):
            start = time.perf_counter()
            ok = False
            result: Any = None
            try:
                result = await fn(*args, **kwargs)
                ok = True
                return result
            finally:
                if _TELEMETRY and _api_key_var.get():
                    chars, images = _content_size(result) if ok else (0, 0)
                    payload = {
                        "tool": fn.__name__,
                        "ok": ok,
                        "duration_ms": (time.perf_counter() - start) * 1000,
                        "response_chars": chars,
                        "image_bytes": images,
                        "document_id": kwargs.get("document_id") if isinstance(kwargs.get("document_id"), str) else None,
                        "detail": _detail(kwargs),
                    }
                    task = asyncio.create_task(api.report_tool_call(payload))
                    _pending.add(task)
                    task.add_done_callback(_pending.discard)

        return register(run)

    return wrap


_register_tool = mcp.tool
mcp.tool = _tool  # type: ignore[method-assign]


# ─── Helpers ────────────────────────────────────────────────

def _json(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str)


def _use_api_key(ctx: Context) -> None:
    """Read the Authorization header from THIS specific call's HTTP request
    and make it available to docforge_mcp.client's API wrappers.

    Deliberately NOT an ASGI middleware: a Streamable HTTP session's messages
    are all processed by one long-lived task created when the session starts
    (the 'initialize' call), so a ContextVar set by middleware on a later
    request never reaches it — only the header sent on session creation would
    "stick". ctx.request_context.request is threaded in per-message by the
    SDK itself, so it always reflects the header actually sent with *this*
    tool/resource call, regardless of session age.
    """
    request = ctx.request_context.request
    auth = request.headers.get("authorization", "") if request is not None else ""
    key = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not key:
        raise DocForgeError(
            "No API key found. Send an Authorization: Bearer <key> header with this request."
        )
    _api_key_var.set(key)


async def _resolve_body_section(document_id: str) -> tuple[dict, str]:
    doc = await api.get_document(document_id)
    sections = doc.get("sections", [])
    body = next((s for s in sections if s.get("section_type") == "body"), None)
    if body is None:
        raise DocForgeError(f"Document {document_id} has no body section.")
    return doc, body["id"]


def _body_content(doc: dict) -> str:
    sections = doc.get("sections", [])
    body = next((s for s in sections if s.get("section_type") == "body"), None)
    return (body.get("active_version_content") or "") if body else ""


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)


def _extract_headings(content: str) -> list[dict]:
    return [
        {"level": len(m.group(1)), "text": m.group(2), "start": m.start()}
        for m in _HEADING_RE.finditer(content)
    ]


def _heading_span(content: str, heading: str) -> tuple[int, int, int] | None:
    """Return (start, end, level) for the section under `heading`: `start` is
    where the heading line begins, `end` is where the next heading of equal
    or higher level begins (or len(content)). None if the heading isn't found."""
    headings = _extract_headings(content)
    idx = next(
        (i for i, h in enumerate(headings) if h["text"].strip().lower() == heading.strip().lower()),
        None,
    )
    if idx is None:
        return None
    target = headings[idx]
    end = len(content)
    for later in headings[idx + 1:]:
        if later["level"] <= target["level"]:
            end = later["start"]
            break
    return target["start"], end, target["level"]


def _extract_section_by_heading(content: str, heading: str) -> str | None:
    span = _heading_span(content, heading)
    if span is None:
        return None
    start, end, _ = span
    return content[start:end].rstrip()


# ─── Tools ──────────────────────────────────────────────────

@mcp.tool()
async def get_user_info(*, ctx: Context) -> str:
    """Get account info and remaining document creations for the current week."""
    _use_api_key(ctx)
    data = await api.get_user_info()
    return (
        f"Name: {data.get('name') or '(no name)'}\n"
        f"Email: {data.get('email')}\n"
        f"Document creations remaining: {data.get('document_creations_remaining')} "
        f"(weekly allowance: {data.get('weekly_document_creations')})"
    )


@mcp.tool()
async def list_documents(*, ctx: Context) -> str:
    """List all DocForge editor documents belonging to the current user."""
    _use_api_key(ctx)
    docs = await api.list_documents()
    if not docs:
        return "No documents found."
    lines = [f"- [{d['title']}] id={d['id']} updated={d.get('updated_at', '')[:10]}" for d in docs]
    return "\n".join(lines)


@mcp.tool()
async def create_document(title: str, context: str = "", *, ctx: Context) -> str:
    """Create a new DocForge editor document using one weekly document creation.
    Returns the document id, title, and browser URL.

    Args:
        title: Document title.
        context: Optional short description of what this document is for.
    """
    _use_api_key(ctx)
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
async def get_document(document_id: str, full: bool = False, *, ctx: Context) -> str:
    """Read a document's metadata and outline (section headings) by default —
    call this before write_section to see the current structure.
    Pass full=True for the complete body content (e.g. before a full rewrite
    with write_section). To read just one section, use get_section instead of
    full=True — cheaper when the document is large and you only need part of it.

    Args:
        document_id: Document UUID.
        full: If True, return the complete body content instead of just an outline.
    """
    _use_api_key(ctx)
    doc = await api.get_document(document_id)
    content = _body_content(doc)
    header = (
        f"Title: {doc['title']}\n"
        f"ID: {doc['id']}\n"
        f"Phase: {doc.get('current_phase')}\n"
    )
    headings = _extract_headings(content)
    if full or not headings:
        return header + f"Content ({len(content)} chars):\n\n{content}"
    outline = "\n".join(f"{'  ' * (h['level'] - 1)}- {h['text']}" for h in headings)
    return (
        header + f"Content: {len(content)} chars across {len(headings)} heading(s).\n\n"
        f"Outline:\n{outline}\n\n"
        "Use get_section(document_id, heading) to read one section, or "
        "get_document(document_id, full=True) to read everything."
    )


@mcp.tool()
async def get_section(document_id: str, heading: str, *, ctx: Context) -> str:
    """Read just the content under one Markdown heading in the document body,
    from that heading up to (not including) the next heading of the same or
    higher level. Cheaper than get_document(full=True) when you only need part
    of a large document. Call get_document first to see available headings.

    Args:
        document_id: Document UUID.
        heading: Exact heading text (without the '#' markers), e.g. 'Risks'.
    """
    _use_api_key(ctx)
    doc = await api.get_document(document_id)
    content = _body_content(doc)
    excerpt = _extract_section_by_heading(content, heading)
    if excerpt is None:
        headings = _extract_headings(content)
        available = ", ".join(h["text"] for h in headings) or "(none found)"
        raise DocForgeError(f"Heading {heading!r} not found in '{doc['title']}'. Available: {available}.")
    return excerpt


@mcp.tool()
async def write_section(document_id: str, content: str, note: str = "", *, ctx: Context) -> str:
    """Replace the full body section content of a document.
    To add to the end without resending everything, use append_section instead.
    For a small edit, use patch_section. To read the current content first,
    call get_document(document_id, full=True).

    IMPORTANT: by default your write does NOT apply immediately — it becomes a
    pending SUGGESTION that the user reviews as a diff in their browser and
    accepts or rejects (like a pull request). Check the outcome later with
    check_suggestions, and read any review feedback with get_pending_feedback.
    Documents configured with the 'direct' policy apply writes immediately.

    Args:
        document_id: Document UUID.
        content: Full Markdown content to write.
        note: Optional explanation shown to the reviewer (e.g. 'Analyzed 47 source files').
    """
    _use_api_key(ctx)
    doc, section_id = await _resolve_body_section(document_id)
    result = await api.update_section_content(section_id, content, note or None)
    if isinstance(result, dict) and result.get("mode") == "suggestion":
        return (
            f"Suggestion submitted for '{doc['title']}' ({len(content)} characters).\n"
            f"Suggestion ID: {result.get('suggestion_id')}\n\n"
            f"The write is PENDING human review — the document content is unchanged "
            f"until the user accepts it in their browser. Use check_suggestions to "
            f"see if it was accepted or rejected, and get_pending_feedback to read "
            f"any review comments before rewriting."
        )
    return (
        f"Written {len(content)} characters to '{doc['title']}'. "
        f"The user's browser has been updated in real-time."
    )


@mcp.tool()
async def append_section(document_id: str, content: str, note: str = "", *, ctx: Context) -> str:
    """Append content to the end of a document's body section, without needing
    to read and resend the existing content first. Same suggestion/direct-write
    policy as write_section — check the return value to see which applied.

    Args:
        document_id: Document UUID.
        content: Markdown content to add after the existing body.
        note: Optional explanation shown to the reviewer.
    """
    _use_api_key(ctx)
    doc, section_id = await _resolve_body_section(document_id)
    result = await api.update_section_content(section_id, content, note or None, mode="append")
    if isinstance(result, dict) and result.get("mode") == "suggestion":
        return (
            f"Append suggestion submitted for '{doc['title']}' ({len(content)} characters).\n"
            f"Suggestion ID: {result.get('suggestion_id')}\n\n"
            f"PENDING human review — nothing appended yet. Use check_suggestions to "
            f"see if it was accepted or rejected."
        )
    return (
        f"Appended {len(content)} characters to '{doc['title']}'. "
        f"The user's browser has been updated in real-time."
    )


@mcp.tool()
async def patch_section(
    document_id: str, anchor: str, old_text: str, new_text: str, note: str = "", *, ctx: Context
) -> str:
    """Edit part of a document's body by exact text replacement, scoped to one
    Markdown heading — like a find-and-replace within that section only.
    Cheaper and safer than write_section for small changes: you don't resend
    the whole document, and old_text must match exactly once within the
    section or the call fails (ambiguous or missing match — make old_text more
    specific and retry).

    Args:
        document_id: Document UUID.
        anchor: Exact heading text the edit is scoped to (see get_document for the outline).
        old_text: Exact existing text to replace, within that section.
        new_text: Replacement text.
        note: Optional explanation shown to the reviewer.
    """
    _use_api_key(ctx)
    doc = await api.get_document(document_id)
    content = _body_content(doc)
    span = _heading_span(content, anchor)
    if span is None:
        headings = _extract_headings(content)
        available = ", ".join(h["text"] for h in headings) or "(none found)"
        raise DocForgeError(f"Heading {anchor!r} not found in '{doc['title']}'. Available: {available}.")
    start, end, _level = span
    section_slice = content[start:end]
    occurrences = section_slice.count(old_text)
    if occurrences == 0:
        raise DocForgeError(f"old_text not found under heading {anchor!r}.")
    if occurrences > 1:
        raise DocForgeError(
            f"old_text matches {occurrences} times under heading {anchor!r} — "
            "make it more specific so the edit is unambiguous."
        )
    patched_slice = section_slice.replace(old_text, new_text, 1)
    new_content = content[:start] + patched_slice + content[end:]
    _, section_id = await _resolve_body_section(document_id)
    result = await api.update_section_content(section_id, new_content, note or None)
    if isinstance(result, dict) and result.get("mode") == "suggestion":
        return (
            f"Patch suggestion submitted for '{doc['title']}' (section {anchor!r}).\n"
            f"Suggestion ID: {result.get('suggestion_id')}\n\n"
            f"PENDING human review — nothing changed yet."
        )
    return (
        f"Patched section {anchor!r} in '{doc['title']}'. "
        f"The user's browser has been updated in real-time."
    )


@mcp.tool()
async def check_suggestions(document_id: str, status: str = "", *, ctx: Context) -> str:
    """List your suggestions on a document and their review status.
    Rejected suggestions usually carry a review comment explaining why — address
    it and write again. Statuses: pending, accepted, rejected.

    Args:
        document_id: Document UUID.
        status: Optional filter ('pending', 'accepted', 'rejected'). Empty = all.
    """
    _use_api_key(ctx)
    suggestions = await api.list_suggestions(document_id, status=status or None)
    if not suggestions:
        return "No suggestions found." if not status else f"No {status} suggestions."
    lines = []
    for s in suggestions:
        ts = (s.get("created_at") or "")[:16]
        stale = " (stale: document changed since proposal)" if s.get("is_stale") else ""
        line = f"- [{s.get('status', '?').upper()}] id={s['id']} created={ts}{stale}"
        if s.get("note"):
            line += f"\n  note: {s['note']}"
        if s.get("review_comment"):
            line += f"\n  reviewer said: {s['review_comment']}"
        lines.append(line)
    return "\n".join(lines)


@mcp.tool()
async def get_pending_feedback(document_id: str, *, ctx: Context) -> str:
    """Read open human feedback on a document (comments and suggestion rejections).
    Call this BEFORE writing to incorporate what the user asked for. After you
    address an item, mark it done with resolve_feedback.

    Args:
        document_id: Document UUID.
    """
    _use_api_key(ctx)
    items = await api.list_feedback(document_id, status="open")
    if not items:
        return "No open feedback. You're clear to write."
    lines = []
    for f in items:
        ts = (f.get("created_at") or "")[:16]
        anchor = f" (section {f['section_id']})" if f.get("section_id") else ""
        origin = " [from a rejected suggestion]" if f.get("suggestion_id") else ""
        lines.append(f"- id={f['id']} {ts}{anchor}{origin}\n  {f['content']}")
    return "Open feedback items:\n" + "\n".join(lines)


@mcp.tool()
async def resolve_feedback(feedback_id: str, resolution_note: str = "", *, ctx: Context) -> str:
    """Mark a feedback item as resolved after addressing it in the document.

    Args:
        feedback_id: Feedback UUID (from get_pending_feedback).
        resolution_note: Short description of how you addressed it.
    """
    _use_api_key(ctx)
    result = await api.resolve_feedback(feedback_id, resolution_note or None)
    return f"Feedback {feedback_id} marked as {result.get('status', 'resolved')}."


@mcp.tool()
async def snapshot_section(
    document_id: str,
    version_name: str = "",
    change_summary: str = "",
    *,
    ctx: Context,
) -> str:
    """Save a named version checkpoint for the body section.
    Use before and after large rewrites so both states are preserved.

    Args:
        document_id: Document UUID.
        version_name: Short label for this snapshot (e.g. 'Initial draft').
        change_summary: Optional longer description of what changed.
    """
    _use_api_key(ctx)
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
async def list_versions(document_id: str, *, ctx: Context) -> str:
    """List version history for the body section.
    Check this before a major write to see who last edited the document.

    Args:
        document_id: Document UUID.
    """
    _use_api_key(ctx)
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
async def select_active_version(document_id: str, version_id: str, *, ctx: Context) -> str:
    """Switch the active (displayed) version of the body section.
    The user sees the new version in their browser instantly.
    Use list_versions to find version IDs.

    Args:
        document_id: Document UUID.
        version_id: Version UUID to make active.
    """
    _use_api_key(ctx)
    doc, section_id = await _resolve_body_section(document_id)
    await api.restore_version(section_id, version_id)
    return (
        f"Version {version_id} is now active for '{doc['title']}'. "
        f"The user's browser has been updated."
    )


@mcp.tool()
async def get_version_content(document_id: str, version_id: str, *, ctx: Context) -> str:
    """Read the full content of a specific (possibly inactive) version of the body section.
    Use this to diff or preview a version before calling select_active_version.

    Args:
        document_id: Document UUID.
        version_id: Version UUID. Obtain via list_versions.
    """
    _use_api_key(ctx)
    _, section_id = await _resolve_body_section(document_id)
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
    *,
    ctx: Context,
) -> str:
    """Update the name and/or change summary of an existing version.
    At least one of version_name or change_summary must be provided.

    Args:
        document_id: Document UUID.
        version_id: Version UUID.
        version_name: New label for the version (omit to keep current).
        change_summary: New description (omit to keep current; empty string clears it).
    """
    _use_api_key(ctx)
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
async def get_activity(document_id: str, limit: int = 20, *, ctx: Context) -> str:
    """List recent activity (writes, snapshots, version switches) for a document.
    Use this to see what other actors (humans or other agents) have done.

    Args:
        document_id: Document UUID.
        limit: Maximum number of entries to return (default 20, max 50).
    """
    _use_api_key(ctx)
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


# ─── Pipeline (BYOA — you execute, the human checkpoints) ────

@mcp.tool()
async def list_document_types(*, ctx: Context) -> str:
    """List structured document types (e.g. RFC) with their section structure.
    Use a type's slug with start_pipeline to produce that document end-to-end."""
    _use_api_key(ctx)
    types = await api.list_document_types()
    if not types:
        return "No document types available."
    lines = []
    for t in types:
        sections = ", ".join(
            s.get("section_key", "?")
            for s in sorted(t.get("sections", []), key=lambda s: s.get("order", 0))
        )
        lines.append(f"- {t['slug']}: {t['name']} — sections: {sections}\n  {t.get('description', '')}")
    return "\n".join(lines)


@mcp.tool()
async def list_pipelines(*, ctx: Context) -> str:
    """List the user's custom pipeline definitions (cloned from a baseline and
    edited). Pass an id to start_pipeline to run one instead of the baseline."""
    _use_api_key(ctx)
    definitions = await api.list_pipeline_definitions()
    if not definitions:
        return "No custom pipelines. start_pipeline runs the baseline for a document type."
    lines = []
    for d in definitions:
        steps = d.get("steps", [])
        lines.append(f"- {d['name']} id={d['id']} steps={len(steps)}")
    return "\n".join(lines)


@mcp.tool()
async def start_pipeline(
    document_context: str,
    document_type_slug: str = "rfc",
    title: str = "",
    pipeline_definition_id: str = "",
    *,
    ctx: Context,
) -> str:
    """Start a structured document pipeline that YOU execute step by step.
    Uses one weekly document creation. The server drives the state machine: call get_next_step for
    instructions, do the work with your own tools (read the repo, talk to your
    user), then submit_step. The user approves checkpoints in the browser.
    The pipeline is durable — if your session dies, any future session resumes
    exactly where you left off via get_next_step.

    Args:
        document_context: What this document is about (min 20 chars) — the problem, goal, scope.
        document_type_slug: Document type from list_document_types (default 'rfc').
        title: Optional document title.
        pipeline_definition_id: Optional custom pipeline id (see list_pipelines) to run
            the user's customized flow instead of the baseline.
    """
    _use_api_key(ctx)
    result = await api.start_pipeline(
        document_type_slug, title or None, document_context,
        pipeline_definition_id=pipeline_definition_id or None,
    )
    doc_id = result["document_id"]
    step = result.get("next_step", {})
    url = api.document_url(doc_id)
    return (
        f"Pipeline started.\n"
        f"Document: {result.get('title')} (id={doc_id})\n"
        f"URL: {url} — share with the user so they can follow and approve checkpoints.\n\n"
        f"FIRST STEP ({step.get('phase')}"
        + (f" / {step.get('section_key')}" if step.get("section_key") else "")
        + f"):\n{step.get('instructions', '')}"
    )


@mcp.tool()
async def get_next_step(document_id: str, known_context_hash: str = "", *, ctx: Context) -> str:
    """Get the current pipeline step: instructions + accumulated context.
    Also use this to resume a pipeline after an interruption, or to poll after
    a human checkpoint. Pass known_context_hash (the hash from your last call
    for this document, if any) to skip resending the context block when
    nothing has changed since.

    Args:
        document_id: Document UUID.
        known_context_hash: The context hash from your previous get_next_step
            response for this document, if you have one.
    """
    _use_api_key(ctx)
    step = await api.get_next_step(document_id)
    status = step.get("status")
    if status in ("completed", "waiting_human"):
        return f"[{status.upper()}] {step.get('message', '')}"
    header = (
        f"STEP {step.get('step_index', 0) + 1}/{step.get('total_steps', '?')} — "
        f"{step.get('phase')}"
        + (f" / {step.get('section_key')}" if step.get("section_key") else "")
    )
    context_hash = step.get("context_hash", "")
    if known_context_hash and known_context_hash == context_hash:
        return (
            f"{header}\n\n{step.get('instructions', '')}\n\n"
            f"--- CONTEXT UNCHANGED (hash={context_hash}) ---\n"
            "Same as your last call for this document — no need to re-read it."
        )
    context = step.get("context") or {}
    return (
        f"{header}\n\n{step.get('instructions', '')}\n\n"
        f"--- CONTEXT (hash={context_hash}) ---\n{_json(context)}"
    )


@mcp.tool()
async def submit_step(document_id: str, payload: dict[str, Any], *, ctx: Context) -> str:
    """Submit the result of the current pipeline step.
    The payload shape depends on the step — get_next_step tells you exactly
    what to send, e.g. {"content": "..."} or {"summaries": {"context": "..."}}
    or {"findings": []}.

    Args:
        document_id: Document UUID.
        payload: Object with the step's payload (shape depends on the current phase).
    """
    _use_api_key(ctx)
    result = await api.submit_step(document_id, payload)
    status = result.get("status")
    if status == "completed":
        return "Step accepted. PIPELINE COMPLETED — the document is finished."
    if status == "waiting_human":
        return (
            "Step accepted. The pipeline is now WAITING FOR HUMAN APPROVAL in the "
            "browser. Ask your user to review the summaries, then call get_next_step."
        )
    header = (
        f"Step accepted. NEXT: {result.get('phase')}"
        + (f" / {result.get('section_key')}" if result.get("section_key") else "")
    )
    return f"{header}\n\n{result.get('instructions', '')}"


# ─── Quality gate (agent-run — free; 'CI for documents') ─────

# ─── Artifacts (the apparatus around the text) ───────────────


@mcp.tool()
async def list_artifacts(document_id: str, *, ctx: Context) -> str:
    """List the diagrams, tables and decision notes attached to a document.
    Shows whether each one is anchored in the text and who created it.

    Args:
        document_id: Document UUID.
    """
    _use_api_key(ctx)
    artifacts = await api.list_artifacts(document_id)
    if not artifacts:
        return "No artifacts yet. Use create_artifact to attach a diagram, table or decision note."
    lines = []
    for a in artifacts:
        where = "anchored" if a.get("anchored") else "NOT anchored in the text"
        lines.append(
            f"- [{a['kind']}] {a['title']} (key={a['key']}, {where}) "
            f"by {a.get('author') or 'unknown'}"
        )
    return "\n".join(lines)


@mcp.tool()
async def create_artifact(
    document_id: str,
    key: str,
    kind: str,
    title: str,
    content: str,
    *,
    ctx: Context,
) -> str:
    """Attach supporting material to a document: a diagram, a table, or a
    decision note. This is where the reasoning around a change belongs — the
    human reviews it next to the diff instead of losing it in your terminal.

    Attach one when it changes the reviewer's decision, not to show your work.

    After creating it, put the returned directive line into the document body
    (write_section / patch_section) at the point where it should appear. An
    artifact with no directive pointing at it shows as "no anchor".

    Args:
        document_id: Document UUID.
        key: Short slug used to reference it, e.g. 'host-cycle'. Lowercase,
            digits and hyphens only. Unique within the document.
        kind: One of 'diagram', 'table', 'decision'.
        title: Human-readable title shown in the panel.
        content: Markdown. For a diagram use a ```mermaid fence — the browser
            renders it.
    """
    _use_api_key(ctx)
    if kind not in ("diagram", "table", "decision"):
        raise DocForgeError(
            f"kind must be 'diagram', 'table' or 'decision' (got {kind!r})."
        )
    artifact = await api.create_artifact(document_id, key, kind, title, content)
    return (
        f"Artifact '{artifact['title']}' created ({artifact['kind']}).\n"
        f"Anchor it by inserting this line into the body where it belongs:\n\n"
        f"    ::artefato[{artifact['key']}]\n"
    )


@mcp.tool()
async def get_quality_gate(document_id: str, *, ctx: Context) -> str:
    """Quality gate status + everything you need to run the audit yourself.
    Read all sections, check them against each other for contradictions,
    terminology drift and inconsistencies, then submit_quality_findings.
    Running the gate yourself is the public workflow; hosted gates are currently unavailable.

    Args:
        document_id: Document UUID.
    """
    _use_api_key(ctx)
    status_data = await api.get_gate_status(document_id)
    sections_data = await api.get_sections_for_gate(document_id)
    findings = status_data.get("findings", [])
    lines = [
        f"Gate on accept: {'ENABLED' if status_data.get('require_gate_on_accept') else 'disabled'}",
        (
            f"Open findings: {status_data.get('open_findings', 0)} "
            f"({status_data.get('open_high_findings', 0)} high)"
        ),
    ]
    if status_data.get("blocking"):
        lines.append("BLOCKING: suggestions cannot be accepted until high findings are resolved.")
    if findings:
        lines.append("\nCurrent findings:")
        for f in findings:
            lines.append(f"- [{f.get('severity', '?').upper()}] {f.get('section_type')}: {f.get('description')}")
    lines.append(
        "\nTO RUN THE GATE: audit the sections below for cross-section "
        "contradictions, terminology drift, numbers that disagree, and claims "
        "one section makes that another undermines. Then call "
        'submit_quality_findings with [{"section_type", "description", '
        '"severity": "high"|"low"}] — an empty list asserts the document is consistent.'
    )
    lines.append(f"\n--- SECTIONS (JSON) ---\n{_json(sections_data.get('sections', {}))}")
    return "\n".join(lines)


@mcp.tool()
async def submit_quality_findings(document_id: str, findings_json: str, *, ctx: Context) -> str:
    """Report the result of a quality-gate audit you performed.
    Replaces the document's open findings (dismissed ones are preserved).

    Args:
        document_id: Document UUID.
        findings_json: JSON array like
            '[{"section_type": "risks", "description": "...", "severity": "high"}]'.
            Empty array '[]' means the document passed your audit.
            Include "quote" with the exact offending phrase whenever the
            finding is about specific words — the browser underlines it in
            place, which is far more useful to the reviewer than naming a
            section. Add "category" for a short label ("coherence", "scope",
            "terminology").
    """
    _use_api_key(ctx)
    try:
        findings = json.loads(findings_json)
    except json.JSONDecodeError as e:
        raise DocForgeError(f"findings_json is not valid JSON: {e}")
    if not isinstance(findings, list):
        raise DocForgeError("findings_json must be a JSON array.")
    result = await api.submit_quality_findings(document_id, findings)
    count = len(result) if isinstance(result, list) else 0
    if count == 0:
        return "Gate recorded: no findings — document marked consistent."
    return f"Gate recorded: {count} finding(s) now visible to the user in the browser."


# ─── Layout documents ───────────────────────────────────────
# Components placed on a unit grid (@docforge/layout). The agent never sees the
# page: it reads a text map (each page drawn in ASCII + a table), measures and
# previews before writing, and every write says what the layout did on its own.

_LAYOUT_GUIDE_HINT = "Format, positions, components and operations: read docforge://guide/layout."


def _parse_json_arg(value: Any, name: str) -> Any:
    """Accept a JSON value or a JSON string (some clients send objects as strings)."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            raise DocForgeError(f"`{name}` is not valid JSON: {e}") from e
    return value


def _parse_ops(ops: Any) -> list[dict[str, Any]]:
    parsed = _parse_json_arg(ops, "ops")
    if not isinstance(parsed, list) or not parsed:
        raise DocForgeError("`ops` must be a non-empty list of operation objects.")
    return parsed


def _format_diagnostics(diagnostics: list[dict]) -> str:
    if not diagnostics:
        return "No problems."
    lines = []
    for d in diagnostics:
        where = d.get("component") or (f"page {d['page']}" if d.get("page") else None)
        lines.append(f"- [{d['severity']}] {d['code']}{f' ({where})' if where else ''}: {d['message']}")
        for tip in d.get("suggestions") or []:
            lines.append(f"    try: {tip}")
    return "\n".join(lines)


def _format_changes(changes: list[dict]) -> str:
    if not changes:
        return "None: nothing you did not touch moved."
    marks = {"warning": "~", "info": "·"}
    return "\n".join(f"{marks.get(c.get('severity'), '·')} {c['code']}: {c['message']}" for c in changes)


_MAP_MODES = ("summary", "pages", "full")


def _map_mode(value: str) -> str:
    if value not in _MAP_MODES:
        raise DocForgeError("`map` must be summary, pages or full.")
    return value


def _format_layout_result(result: dict, head: str, map_mode: str = "summary") -> str:
    """A write or preview answer: a short summary by default, the level-1 map on request.

    A refused attempt shows only the errors: its map would describe a document
    that does not exist.
    """
    if not result["ok"]:
        return f"{head}\n\nDiagnostics:\n{_format_diagnostics(result['diagnostics'])}"
    summary = result.get("summary") or ""
    if not summary:
        # A layout service from before summaries: fall back to the full answer.
        parts = [head, f"Diagnostics:\n{_format_diagnostics(result['diagnostics'])}"]
        parts.append(f"What the layout did on its own:\n{_format_changes(result.get('changes') or [])}")
        parts.append(f"Map (level 1):\n{result.get('map') or '(none)'}")
        return "\n\n".join(parts)
    parts = [head, summary]
    if map_mode == "summary":
        parts.append('(full map: get_layout_map, or map="pages" with pages=[n])')
    else:
        parts.append(f"Map (level 1):\n{result.get('map') or '(none)'}")
    return "\n\n".join(parts)


def _format_layout_write(result: dict, saved_label: str, map_mode: str = "summary") -> str:
    if result["ok"]:
        head = f"{saved_label} Revision {result['revision']}. Side effects stay as notices (get_layout_notes)."
    else:
        head = (
            f"NOT saved: nothing changed (still revision {result['revision']}). "
            "Fix the errors below and send the operations again."
        )
    return _format_layout_result(result, head, map_mode)


@mcp.tool()
async def create_layout_document(
    title: str,
    content: dict[str, Any] | str | None = None,
    template: str = "",
    format: str = "",  # noqa: A002 (the parameter agents see)
    *,
    ctx: Context,
) -> str:
    """Create a layout document: components placed on a grid of square units
    (8px), measured and paginated by DocForge. Uses one weekly document creation.
    Without `content` it starts empty (an A4 page, 89 × 130 units); then add
    components with apply_layout_ops. To try a whole document first, use
    preview_layout (free, saves nothing).
    Format, positions, components and operations: read docforge://guide/layout first.

    Templates give a finished composition with sample content to replace
    (edit/replaceText): "relatorio" (KPIs, chart with analysis, table, next
    steps), "proposta" (scope, steps, timeline, price), "one-pager" (a product
    or project on one page), "apresentacao" (a 16:9 slide deck: cover, agenda,
    KPIs, chart, next steps). Starting from one is usually faster and better
    composed than starting empty.

    Slides: format="slide" starts an empty 16:9 deck (1280 × 720 px, one slide
    per page, type sized for slides). Put each component on its slide with
    at.page; the `page` op inserts, duplicates, removes or reorders slides.

    Args:
        title: Document title.
        content: Optional full layout document (JSON object, format "docforge/layout", version 3).
        template: Optional. relatorio, proposta, one-pager or apresentacao. Not with content.
        format: Optional, empty documents only: "page" (A4, default) or "slide" (16:9 deck).
    """
    _use_api_key(ctx)
    if template and content is not None:
        raise DocForgeError("Give content or template, not both.")
    if template and template not in ("relatorio", "proposta", "one-pager", "apresentacao"):
        raise DocForgeError("`template` must be relatorio, proposta, one-pager or apresentacao.")
    if format and format not in ("page", "slide"):
        raise DocForgeError('`format` must be "page" or "slide".')
    if format and (template or content is not None):
        raise DocForgeError("`format` is only for an empty document; a template or content brings its own.")
    parsed = _parse_json_arg(content, "content") if content is not None else None
    result = await api.create_layout_document(title, parsed, template or None, format or None)
    url = api.document_url(result["document_id"])
    return (
        f"Layout document created.\nID: {result['document_id']}\nURL: {url}\n"
        f"Share this URL with the user so they can see the rendered pages.\n\n"
        + _format_layout_write(result, "Saved.")
        + f"\n\n{_LAYOUT_GUIDE_HINT}"
    )


@mcp.tool()
async def get_layout_map(
    document_id: str,
    level: int = 1,
    components: list[str] | None = None,
    pages: list[int] | None = None,
    draw: bool = True,
    *,
    ctx: Context,
) -> str:
    """Read a layout document as text, instead of looking at the page.
    Level 0: outline (components per page).
    Level 1: the settings (page, units, guide columns, classes, styles), then each
    page drawn in ASCII — one character per unit across, rows that repeat are left
    out — and a table of its components: id, type, x, y, w, h, classes, a summary
    of the content, and what the layout did (moved by whom, grew, split).
    Level 2: the components you name in full: declared vs drawn position, content,
    every style property with the layer it came from, diagnostics.
    Long documents: ask for some `pages`, or `draw=false` for the tables only.

    Args:
        document_id: Document UUID.
        level: 0, 1 or 2.
        components: Level 2 only: component ids to detail (default: all).
        pages: Level 1 only: 1-based pages to show (default: all).
        draw: Level 1 only: false leaves out the ASCII drawing.
    """
    _use_api_key(ctx)
    result = await api.get_layout_map(document_id, level, components, pages, draw)
    notes = []
    if result.get("open_notices"):
        notes.append(f"{result['open_notices']} open notice(s)")
    if result.get("open_annotations"):
        notes.append(f"{result['open_annotations']} open annotation(s) from people")
    notes_line = f"\nNotes: {', '.join(notes)} — read them with get_layout_notes." if notes else ""
    return f"Revision {result['revision']} · level {result['level']}{notes_line}\n\n{result['text']}"


@mcp.tool()
async def get_layout_document(document_id: str, *, ctx: Context) -> str:
    """Read the raw JSON of a layout document, with its current revision. Use
    get_layout_map for an overview and find_layout to locate things; use this
    only when you need exact content. To change part of a component, the `edit`
    and `replaceText` ops do not need the JSON first."""
    _use_api_key(ctx)
    result = await api.get_layout(document_id)
    content = json.dumps(result["content"], indent=2, ensure_ascii=False)
    return f"Revision {result['revision']}\n\n{content}"


@mcp.tool()
async def apply_layout_ops(
    document_id: str,
    ops: list[dict[str, Any]] | str,
    base_revision: int | None = None,
    pages: list[int] | None = None,
    map: str = "summary",
    note: str = "",
    *,
    ctx: Context,
) -> str:
    """Change a layout document with operations: add, place, update, edit,
    replaceText, remove, setStyle, setRegion, removeRegion, setTokens, setGrid,
    setSurface, removeSurface, setMeta, page, compact, fit (shapes: docforge://guide/layout).
    Positions: {page, x, y, w, h?} in units, or relative — cols:[a,b] for x/w,
    below:"id" or end:true for y.
    To change a word, a paragraph or a cell, use edit (by path, e.g.
    "paragraphs.1", "rows.2.0") or replaceText, not update: update rewrites
    the whole content.
    Refused (nothing saved) only when an op is malformed, names something that
    does not exist, or the result is not a valid document. Layout consequences
    are never refused: whatever grows pushes down only what it runs into, boxes
    that cross a page break move or split.
    The answer is a short summary: what your ops changed (before → after), what
    moved on its own (also kept as notices), problems and free rows per page.
    Ask for the drawing with map="pages" (and pages) or map="full".
    To try first without saving, use preview_layout with the same ops.

    Args:
        document_id: Document UUID.
        ops: List of operation objects, applied in order.
        base_revision: Optional. The revision you based the ops on; refused with a conflict if the document moved on.
        pages: Optional. Only these pages (1-based) in the map (with map="pages").
        map: summary (default), pages (summary + map of `pages`) or full (summary + the whole map).
        note: Optional. Why, in one sentence ("merged the two paragraphs to free space"). The person
            sees it next to this change when reviewing what you did.
    """
    _use_api_key(ctx)
    mode = _map_mode(map)
    result = await api.apply_layout_ops(document_id, _parse_ops(ops), base_revision, pages, note or None)
    return _format_layout_write(result, "Saved.", mode)


@mcp.tool()
async def preview_layout(
    document_id: str | None = None,
    ops: list[dict[str, Any]] | str | None = None,
    content: dict[str, Any] | str | None = None,
    pages: list[int] | None = None,
    map: str = "summary",
    *,
    ctx: Context,
) -> str:
    """See what a change would do before making it. Saves nothing and costs nothing.
    - document_id + ops: the stored document after these ops (the same summary
      apply_layout_ops would give).
    - content (+ optional ops): a whole document that is not stored — draft a
      full layout, check the map, then create_layout_document with it.

    Args:
        document_id: Document UUID (with ops).
        ops: Operation objects to try.
        content: A full layout document to try instead of a stored one.
        pages: Optional. Only these pages (1-based) in the map (with map="pages").
        map: With ops: summary (default), pages or full. A whole document without ops always comes with its map.
    """
    _use_api_key(ctx)
    mode = _map_mode(map)
    if content is not None:
        doc = _parse_json_arg(content, "content")
        parsed_ops = _parse_ops(ops) if ops is not None else None
        result = await api.preview_layout_document(doc, parsed_ops, pages)
        base = "Preview of the document you sent (nothing saved)."
    elif document_id and ops is not None:
        result = await api.preview_layout_ops(document_id, _parse_ops(ops), pages)
        base = f"Preview on top of revision {result.get('base_revision')} (nothing saved)."
    else:
        raise DocForgeError("Pass document_id with ops, or content (optionally with ops).")
    head = base if result["ok"] else f"{base} These ops would be REFUSED — fix the errors below."
    if content is not None and ops is None:
        # A whole draft has no "before": the map is the answer.
        return "\n\n".join([
            head,
            f"Diagnostics:\n{_format_diagnostics(result['diagnostics'])}",
            f"Map (level 1):\n{result.get('map') or '(none)'}",
        ])
    return _format_layout_result(result, head, mode)


@mcp.tool()
async def measure_component(
    component: dict[str, Any] | str,
    widths: list[int] | None = None,
    cols: list[list[int]] | None = None,
    document_id: str | None = None,
    *,
    ctx: Context,
) -> str:
    """How tall a component would be, without placing it anywhere. Use it to
    choose a width or to know where the next component should start.
    Returns, for each width: the height it needs in px and in rows (units),
    whether it would split across pages, and any problem (e.g. a KPI value that
    does not fit). With document_id, it is measured with that document's grid,
    tokens and styles.

    Args:
        component: A component object ({id, type, content, props?, style?, labels?}; no `at` needed).
        widths: Widths to try, in units (e.g. [40, 60]).
        cols: Widths to try as guide column ranges (e.g. [[1, 6], [1, 12]]).
        document_id: Optional. Measure with this document's settings.
    """
    _use_api_key(ctx)
    parsed = _parse_json_arg(component, "component")
    if not isinstance(parsed, dict):
        raise DocForgeError("`component` must be a component object.")
    result = await api.measure_layout_component(parsed, widths, cols, document_id)
    return result["text"]


@mcp.tool()
async def calibrate_style(
    document_id: str,
    variants: list[dict[str, Any]] | str,
    component: str | None = None,
    label: str | None = None,
    selector: str | None = None,
    *,
    ctx: Context,
) -> str:
    """Compare style variants before choosing one. Give exactly one target —
    a component id, a class (label) or a selector (a type, or type.role like
    "text.title-1") — and up to 12 style objects. Each variant is measured on
    the document as it is (nothing is applied): height in units, growth,
    pages, what else would move, and new problems. Then apply the one you pick
    with apply_layout_ops (update style / setStyle).

    Args:
        document_id: Document UUID.
        variants: Style objects, e.g. [{"fontSize": "$size.l"}, {"fontSize": "$size.xl", "padding": "$space.5"}].
        component: Component id to restyle.
        label: Class to restyle.
        selector: Type or type.role to restyle in the whole document.
    """
    _use_api_key(ctx)
    targets = {k: v for k, v in {"component": component, "label": label, "selector": selector}.items() if v}
    if len(targets) != 1:
        raise DocForgeError("Give exactly one of component, label or selector.")
    parsed = _parse_json_arg(variants, "variants")
    if not isinstance(parsed, list) or not parsed:
        raise DocForgeError("`variants` must be a non-empty list of style objects.")
    result = await api.calibrate_layout_style(document_id, targets, parsed)
    return f"Revision {result['revision']}\n\n{result['text']}"


# Text plus an image: plain content blocks, not structured output (an Image has no JSON schema).
@mcp.tool(structured_output=False)
async def render_page(
    document_id: str,
    page: int = 1,
    scale: float = 0.75,
    highlight: list[str] | None = None,
    *,
    ctx: Context,
) -> list[Any]:
    """Look at a page of a layout document: a PNG drawn by the same library that
    measures and prints it. Use it when you can see images, to check what the
    map cannot show — type sizes, weight, color, breathing room, what draws the
    eye. The map stays the source for positions and ids.

    Args:
        document_id: Document UUID.
        page: 1-based page.
        scale: 0.25 to 2 (1 = the page's real size, about 794×1123 for A4). 0.5–0.75 is enough to judge a page.
        highlight: Component ids to outline on the image.
    """
    _use_api_key(ctx)
    if not 0.25 <= scale <= 2:
        raise DocForgeError("`scale` must be from 0.25 to 2.")
    result = await api.render_layout_page(document_id, page, scale, highlight)
    png = base64.b64decode(result["png"])
    caption = f"Page {result['page']} of {result['pages']} · revision {result['revision']} · {result['width']}×{result['height']}px"
    if highlight:
        caption += f" · outlined: {', '.join(highlight)}"
    return [caption, Image(data=png, format="png")]


@mcp.tool()
async def review_layout(document_id: str, *, ctx: Context) -> str:
    """Review the composition the way a reader would see it: boxes much taller
    than their content, side-by-side boxes with uneven tops or heights, edges
    just off a guide column, a near-empty last page, several main titles.
    Diagnostics say whether things fit; this says whether they look right.
    Each finding comes with the ops that fix it: try them with preview_layout,
    then apply_layout_ops. Run it when a page is done. Saves nothing.

    Args:
        document_id: Document UUID.
    """
    _use_api_key(ctx)
    result = await api.review_layout(document_id)
    return f"Revision {result['revision']}\n\n{result['text']}"


@mcp.tool()
async def find_layout(
    document_id: str,
    text: str | None = None,
    type: list[str] | None = None,
    label: str | None = None,
    page: int | None = None,
    rect: dict[str, int] | None = None,
    state: str | None = None,
    *,
    ctx: Context,
) -> str:
    """Find components in a layout document. Every filter is optional; a
    component must match all of them. Returns the same table rows as the map
    (page, id, type, x, y, w, h, classes, content summary, notes) and, for
    `text`, the words around the hit.

    Args:
        document_id: Document UUID.
        text: Words in the content (case and accents ignored).
        type: Component types, e.g. ["kpi", "chart"].
        label: A class (label) name.
        page: 1-based page.
        rect: An area {page?, x, y, w, h} in units: components drawn over it.
        state: One of error, warning, moved, grew, split, clamped, tight.
    """
    _use_api_key(ctx)
    result = await api.find_in_layout(document_id, text, type, label, page, rect, state)
    return f"Revision {result['revision']}\n\n{result['text']}"


@mcp.tool()
async def get_layout_notes(
    document_id: str,
    status: str = "open",
    kind: str | None = None,
    component: str | None = None,
    *,
    ctx: Context,
) -> str:
    """Read the notes on a layout document:
    - notices: what the layout did on its own after a write (a box pushed to the
      next page, a split, the page limit) — they close themselves when no longer true;
    - annotations: notes people pinned to a component or an area of the grid.
    Each note comes with where its anchor is NOW and what is drawn there.
    Annotations are threads: replies are listed under their note. Notes marked
    [for you] are requests the person made to you: act on them, answer with
    reply_layout_note, then resolve_layout_note.

    Args:
        document_id: Document UUID.
        status: open (default), acknowledged, resolved or all.
        kind: notice or annotation (default: both).
        component: Only notes anchored to this component.
    """
    _use_api_key(ctx)
    result = await api.list_layout_notes(document_id, status, kind, component)
    every = result["notes"]
    replies: dict[str, list[dict]] = {}
    for n in every:
        if n.get("parent_id"):
            replies.setdefault(n["parent_id"], []).append(n)
    # Requests for the agent first, then the rest in order.
    notes = sorted((n for n in every if not n.get("parent_id")), key=lambda n: not n.get("for_agent"))
    if not notes:
        return f"Revision {result['revision']}: no {status if status != 'all' else ''} notes.".replace("  ", " ")
    asks = sum(1 for n in notes if n.get("for_agent") and n["status"] == "open")
    lines = [f"Revision {result['revision']} · {len(notes)} note(s)" + (f" · {asks} request(s) for you" if asks else "")]
    for n in notes:
        if n.get("code") == "review-request":
            data = n.get("data") or {}
            questions = "; ".join(q.get("text", "") for q in data.get("questions") or [])
            head = f"[review request by {'an agent' if n.get('by_agent') else 'a person'}]"
            if questions:
                head += f" questions: {questions} —"
        elif n.get("code") == "review-answer":
            head = "[review answer by a person]"
        elif n["kind"] == "annotation":
            who = "an agent" if n.get("by_agent") else "a person"
            head = f"[{'for you · ' if n.get('for_agent') else ''}annotation by {who}]"
        else:
            head = f"[notice {n['severity']} {n.get('code')}]"
        lines.append(f"- {head} {n['message']}")
        anchor = n.get("anchor") or {}
        if n.get("where"):
            lines.append(f"    now: {n['where']}")
        elif anchor:
            lines.append(f"    anchor: {json.dumps(anchor)}")
        status_part = n["status"] + (f" — {n['resolution_note']}" if n.get("resolution_note") else "")
        lines.append(f"    id {n['id']} · revision {n['revision']} · {status_part}")
        for r in replies.get(n["id"], []):
            lines.append(f"    ↳ {'agent' if r.get('by_agent') else 'person'}: {r['message']}")
    return "\n".join(lines)


@mcp.tool()
async def request_review(
    document_id: str,
    summary: str,
    focus: list[str] | None = None,
    questions: list[dict[str, Any]] | str | None = None,
    *,
    ctx: Context,
) -> str:
    """Hand the layout document to the person when you are done (or stuck):
    a short summary of what you did, the components to look at first, and up to
    5 questions with options. The person sees it next to the page and answers
    with a click; answers come back in get_layout_notes as annotations by a
    person ("review-answer"). Ask only what you cannot decide yourself.

    Args:
        document_id: Document UUID.
        summary: What you did, in one or two sentences, for the person.
        focus: Component ids to look at first.
        questions: [{"text": "Chart beside the text or below it?", "options": ["Beside", "Below"]}].
    """
    _use_api_key(ctx)
    parsed = _parse_json_arg(questions, "questions") if questions is not None else []
    if not isinstance(parsed, list) or len(parsed) > 5:
        raise DocForgeError("`questions` must be a list of at most 5 {text, options} objects.")
    note = await api.request_layout_review(document_id, summary, focus or [], parsed)
    return (
        f"Review requested (note {note['id']}). The person sees it on the page; "
        "read the answers later with get_layout_notes(kind=\"annotation\")."
    )


@mcp.tool()
async def resolve_layout_note(note_id: str, note: str = "", status: str = "resolved", *, ctx: Context) -> str:
    """Close (or acknowledge, or reopen) a layout note after handling it.

    Args:
        note_id: Note UUID (from get_layout_notes).
        note: What you did, for the person reading it later.
        status: resolved (default), acknowledged or open.
    """
    _use_api_key(ctx)
    if status not in ("resolved", "acknowledged", "open"):
        raise DocForgeError("`status` must be resolved, acknowledged or open.")
    result = await api.update_layout_note(note_id, status, note or None)
    return f"Note {result['id']} is now {result['status']}."


@mcp.tool()
async def reply_layout_note(document_id: str, note_id: str, message: str, *, ctx: Context) -> str:
    """Answer in a note's thread (the person sees it next to the page): what you
    did about it, or a question back. Replying to a resolved note opens it again.

    Args:
        document_id: Document UUID.
        note_id: The note (or any reply in its thread) from get_layout_notes.
        message: Your answer.
    """
    _use_api_key(ctx)
    reply = await api.reply_layout_note(document_id, note_id, message)
    return f"Replied (note {reply['id']}, thread {reply.get('parent_id') or note_id})."


# ─── Themes ──────────────────────────────────────────────────


def _theme_line(t: dict[str, Any]) -> str:
    colors = t["tokens"].get("color") or {}
    fonts = t["tokens"].get("font") or {}
    swatch = ", ".join(f"{k} {colors[k]}" for k in ("surface", "text", "primary") if k in colors)
    font = f" · titles {fonts['heading']}" if fonts.get("heading") else ""
    ref = t.get("key") or t["id"]
    return f"- {t['name']} ({ref}){' — ' + t['description'] if t.get('description') else ''}\n    {swatch}{font}"


@mcp.tool()
async def list_layout_themes(*, ctx: Context) -> str:
    """Themes for layout documents: the built-in ones and the ones the person
    (or you) saved. A theme sets colors (including the page color, `surface`),
    fonts and corner radii. Apply one with apply_layout_theme."""
    _use_api_key(ctx)
    result = await api.list_layout_themes()
    builtin = [t for t in result["themes"] if t.get("builtin")]
    saved = [t for t in result["themes"] if not t.get("builtin")]
    lines = ["Built-in:"] + [_theme_line(t) for t in builtin]
    lines += ["", "Saved:"] + ([_theme_line(t) for t in saved] or ["- none yet (save_layout_theme)"])
    lines += ["", f"Fonts you can use: {', '.join(result['fonts'])}."]
    return "\n".join(lines)


@mcp.tool()
async def apply_layout_theme(document_id: str, theme: str, *, ctx: Context) -> str:
    """Apply a theme to a layout document in one write: every color, both fonts
    and the radii (what the theme leaves out goes back to the defaults), plus
    its name. Components that use tokens ($color.primary…) follow; literal
    colors written on components do not.

    Args:
        document_id: Document UUID.
        theme: Built-in key (sober, executive, green, forge, editorial, tech, night), a saved theme's id, or a theme name.
    """
    _use_api_key(ctx)
    result = await api.apply_layout_theme(document_id, theme)
    return _format_layout_write(result, "Theme applied.")


@mcp.tool()
async def save_layout_theme(
    name: str,
    tokens: dict[str, Any] | str | None = None,
    from_document: str = "",
    description: str = "",
    *,
    ctx: Context,
) -> str:
    """Save a theme the person can reuse in any layout document (it appears in
    their Design panel). Give `tokens` ({"color": {...}, "font": {"sans": ...,
    "heading": ...}, "radius": {...}, "size": {...}}) or `from_document` to
    save a document's current tokens. A dark theme sets color.surface dark and
    color.text light; keep text readable on surface and subtle.

    Args:
        name: Theme name shown to people.
        tokens: Token groups: color, font, size, space, radius, lineHeight.
        from_document: A layout document UUID whose tokens to save instead.
        description: One line on when to use it.
    """
    _use_api_key(ctx)
    if (tokens is None) == (not from_document):
        raise DocForgeError("Give tokens or from_document (one of them).")
    if from_document:
        layout = await api.get_layout(from_document)
        parsed = (layout.get("content") or {}).get("tokens") or {}
        if not parsed:
            raise DocForgeError("That document uses the default tokens; there is nothing to save.")
    else:
        parsed = _parse_json_arg(tokens, "tokens")
    saved = await api.save_layout_theme(name, parsed, description or None)
    return f"Theme saved: {saved['name']} (id {saved['id']}). Apply it with apply_layout_theme."


# ─── Saved versions ──────────────────────────────────────────


@mcp.tool()
async def save_layout_version(document_id: str, name: str, note: str = "", *, ctx: Context) -> str:
    """Save the layout document's current state as a named version (like
    "Sent to the client"), so the person can find it in the timeline and come
    back to it. Save one before a big change. Nothing is copied: it names the
    current revision.

    Args:
        document_id: Document UUID.
        name: Short version name.
        note: Optional: what this version is.
    """
    _use_api_key(ctx)
    saved = await api.save_layout_version(document_id, name, note or None)
    return f"Version saved: \"{saved['name']}\" = revision {saved['revision']}."


@mcp.tool()
async def list_layout_versions(document_id: str, all_edits: bool = False, limit: int = 20, *, ctx: Context) -> str:
    """The layout document's history, newest first: saved versions only, or
    (all_edits=True) every write with who made it and what it did.

    Args:
        document_id: Document UUID.
        all_edits: Every write instead of saved versions only.
        limit: How many to list (max 100).
    """
    _use_api_key(ctx)
    result = await api.list_layout_revisions(document_id, named=not all_edits, limit=max(1, min(limit, 100)))
    rows = result["revisions"]
    if not rows:
        return f"Revision {result['revision']}: no saved versions yet (save_layout_version)." if not all_edits else "No history."
    lines = [f"Now at revision {result['revision']}."]
    for r in rows:
        who = "agent" if r.get("by_agent") else "person"
        what = r.get("description") or ""
        if r.get("summary"):
            ops = ", ".join(f"{k}×{v}" for k, v in r["summary"]["ops"].items())
            what = f"{what} ({ops})" if what else ops
        name = f"★ {r['name']} — " if r.get("name") else ""
        note = f"\n    {r['note']}" if r.get("note") else ""
        lines.append(f"- r{r['revision']} · {name}{what} · by {who} · {r.get('created_at') or ''}{note}")
    return "\n".join(lines)


@mcp.tool()
async def restore_layout_version(document_id: str, revision: int, *, ctx: Context) -> str:
    """Bring back an earlier revision of the layout document. It becomes a new
    write on top (nothing is erased; the history keeps everything), so it can be
    undone the same way.

    Args:
        document_id: Document UUID.
        revision: The revision to bring back (from list_layout_versions).
    """
    _use_api_key(ctx)
    past = await api.get_layout_revision(document_id, revision)
    current = await api.get_layout(document_id)
    result = await api.replace_layout(document_id, past["content"], current["revision"])
    return _format_layout_write(result, f"Revision {revision} restored.")


# ─── Resources ───────────────────────────────────────────────

@mcp.resource("docforge://documents")
async def resource_list_documents(ctx: Context) -> str:
    """JSON list of all your DocForge editor documents."""
    _use_api_key(ctx)
    docs = await api.list_documents()
    return _json(docs)


@mcp.resource("docforge://document/{document_id}")
async def resource_get_document(document_id: str, ctx: Context) -> str:
    """Current body content of the document as Markdown."""
    _use_api_key(ctx)
    doc = await api.get_document(document_id)
    content = _body_content(doc)
    return f"---\ntitle: {doc['title']}\nid: {doc['id']}\n---\n\n{content}"


@mcp.resource("docforge://document/{document_id}/versions")
async def resource_list_versions(document_id: str, ctx: Context) -> str:
    """JSON version history for the body section."""
    _use_api_key(ctx)
    _, section_id = await _resolve_body_section(document_id)
    versions = await api.list_versions(section_id)
    return _json(versions)


@mcp.resource("docforge://guide/system-prompt")
async def resource_system_prompt() -> str:
    """Orientation brief: how to operate on DocForge documents via MCP."""
    return read_resource("guide", "system_prompt.md")


@mcp.resource("docforge://guide/layout")
async def resource_layout_guide() -> str:
    """How layout documents work: the grid, the 11 components, the operations and styles."""
    return read_resource("guide", "layout.md")


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


@mcp.resource("docforge://writing")
async def resource_list_writing_guides() -> str:
    """JSON index of curated writing guides by document type (Ideia B genéricos)."""
    return _json([
        {"slug": slug, "uri": f"docforge://writing/{slug}"}
        for slug in list_writing_guides()
    ])


@mcp.resource("docforge://writing/{doc_type}")
async def resource_writing_guide(doc_type: str) -> str:
    """Curated writing guide for a document type (e.g. 'adr', 'postmortem', 'runbook')."""
    filename = f"{doc_type.replace('-', '_')}.md"
    try:
        return read_resource("writing", filename)
    except (FileNotFoundError, ModuleNotFoundError):
        available = ", ".join(list_writing_guides())
        raise DocForgeError(f"Writing guide '{doc_type}' not found. Available: {available}.")


# ─── Prompts ─────────────────────────────────────────────────

@mcp.prompt()
async def docforge_orientation() -> str:
    """Agent orientation brief — surfaces via prompts/list so MCP clients can inject it
    automatically, without the agent needing to know the resource URI."""
    return read_resource("guide", "system_prompt.md")


@mcp.prompt()
async def write_document(doc_type: str) -> str:
    """Curated writing guide for a document type. Valid types: adr, postmortem,
    runbook, rfc. Inject before drafting that kind of document."""
    filename = f"{doc_type.strip().lower().replace('-', '_')}.md"
    try:
        return read_resource("writing", filename)
    except (FileNotFoundError, ModuleNotFoundError):
        available = ", ".join(list_writing_guides())
        return f"Unknown document type '{doc_type}'. Available guides: {available}."


# ─── Entry point ─────────────────────────────────────────────

def serve() -> None:
    """Streamable HTTP transport — for hosted/production deployment.

    Authentication: each tool/resource call reads its own Authorization: Bearer
    header via ctx.request_context.request (see _use_api_key) — no ASGI
    middleware needed. This is deliberate: a Streamable HTTP session's messages
    are all processed by one long-lived task started at session creation, so a
    ContextVar set by middleware on a later request would never reach it.

    Set environment variables:
      HOST                  bind address (default: 0.0.0.0)
      PORT                  port (default: 8001)
      DOCFORGE_API_BASE     DocForge backend URL
      DOCFORGE_FRONTEND_BASE  DocForge frontend URL (for document URLs returned to agents)
    """
    import uvicorn

    app = mcp.streamable_http_app()

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    serve()
