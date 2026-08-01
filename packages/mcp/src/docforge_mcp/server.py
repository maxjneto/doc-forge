"""DocForge MCP server — tools and resources for AI agents.

Transport: Streamable HTTP. Clients connect to the hosted server and
authenticate with an `Authorization: Bearer <api-key>` header on every
request. Each tool/resource reads its own header via ctx.request_context
(see _use_api_key) rather than an ASGI middleware — required because a
session's messages all run in one long-lived task past the first request.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings

import docforge_mcp.client as api
from docforge_mcp.client import DocForgeError, _api_key_var
from docforge_mcp.resources.loader import (
    list_recipes,
    list_writing_guides,
    read_resource,
)

# DNS rebinding protection is handled by Cloudflare in production; disable the
# built-in check so requests with custom Host headers (mcp.doc-forge.dev) are
# accepted without needing to be in an allowlist.
mcp = FastMCP(
    "docforge",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


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
    """Get the current user's info: name, email, credits, weekly_credits.
    Call this before create_document to confirm the user has enough credits."""
    _use_api_key(ctx)
    data = await api.get_user_info()
    return (
        f"Name: {data.get('name') or '(no name)'}\n"
        f"Email: {data.get('email')}\n"
        f"Credits: {data.get('credits')} (weekly allowance: {data.get('weekly_credits')})"
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
    """Create a new DocForge editor document. Costs 1 credit — call get_user_info first.
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
    Costs 1 credit. The server drives the state machine: call get_next_step for
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

@mcp.tool()
async def get_quality_gate(document_id: str, *, ctx: Context) -> str:
    """Quality gate status + everything you need to run the audit yourself.
    Read all sections, check them against each other for contradictions,
    terminology drift and inconsistencies, then submit_quality_findings.
    Running the gate yourself is free; a server-run gate costs the user credits.

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
