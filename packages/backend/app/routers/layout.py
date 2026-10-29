"""Layout documents — components placed on a unit grid (@docforge/layout).

A layout document is a `Document` with `document_mode="layout"` whose content
lives in `document_layouts` as one JSON document. The backend never interprets
that JSON: the layout service validates it, applies operations to it, measures
and finds components and writes the text map the agent reads. The backend owns
what the service cannot: permissions, storage, revisions, notes and activity.

A write is refused only when it cannot be used: a malformed op, an unknown id,
an invalid document. Everything the layout does on its own as a consequence (a
box pushed to the next page, a table that now splits, the page limit) is
accepted, returned as `changes` and stored as notices (`layout_notes`).
Nothing here saves without a write: previews, measurements and finds are free.
"""

import datetime
import secrets
import time
import uuid
from collections import deque
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, DocumentLayout, DocumentLayoutRevision, LayoutNote, LayoutTheme
from app.models.user import User
from app.schemas.layout import (
    LayoutCalibrateRequest,
    LayoutCalibrateResponse,
    LayoutDocumentCreate,
    LayoutFindResponse,
    LayoutImageResponse,
    LayoutMapResponse,
    LayoutMeasureRequest,
    LayoutMeasureResponse,
    LayoutNoteCreate,
    LayoutNoteResponse,
    LayoutNotesResponse,
    LayoutNoteUpdate,
    LayoutOpsRequest,
    LayoutPreviewRequest,
    LayoutPreviewResponse,
    LayoutPublishRequest,
    LayoutPublishState,
    LayoutReplaceRequest,
    LayoutReviewData,
    LayoutReviewResponse,
    LayoutRevisionItem,
    LayoutRevisionResponse,
    LayoutRevisionsResponse,
    LayoutRevisionUpdate,
    LayoutStateResponse,
    LayoutThemeApply,
    LayoutThemeCreate,
    LayoutThemeResponse,
    LayoutThemesResponse,
    LayoutThemeUpdate,
    LayoutVersionCreate,
    LayoutWriteResponse,
)
from app.schemas.sse import SSEEvent
from app.services import access, actor, layout_templates, layout_themes
from app.services import db as db_service
from app.services import layout as layout_service
from app.services import sse as sse_service
from app.services.layout_notes import record_changes
from app.services.observability import capture_account_event, capture_event


def _track(request: Request, user_id: str, document_id: uuid.UUID | str, event: str, props: dict | None = None) -> None:
    """A layout usage event, tagged with who acted: `agent` (API key, i.e. MCP) or `person`."""
    source = "agent" if getattr(request.state, "api_key_id", None) else "person"
    capture_event(str(user_id), str(document_id), event, {"source": source, **(props or {})})

router = APIRouter(tags=["layout"])

LAYOUT_MODE = "layout"
FIND_STATES = {"error", "warning", "moved", "grew", "split", "clamped", "tight"}


def _errors(diagnostics: list[dict]) -> list[dict]:
    return [d for d in diagnostics if d.get("severity") == "error"]


def _int_list(raw: str | None, name: str) -> list[int] | None:
    if not raw:
        return None
    try:
        values = [int(part) for part in raw.split(",") if part.strip()]
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"`{name}` must be comma-separated whole numbers.") from e
    if any(v < 0 for v in values):
        raise HTTPException(status_code=422, detail=f"`{name}` must not be negative.")
    return values


async def _load(db: AsyncSession, document_id: uuid.UUID, user: User, capability) -> tuple[Document, DocumentLayout]:
    doc = await access.require(db, document_id, user, capability)
    if doc.document_mode != LAYOUT_MODE:
        raise HTTPException(status_code=400, detail="This is not a layout document.")
    result = await db.execute(select(DocumentLayout).where(DocumentLayout.document_id == document_id))
    layout = result.scalar_one_or_none()
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout content not found")
    return doc, layout


def _check_revision(layout: DocumentLayout, base_revision: int | None) -> None:
    if base_revision is not None and base_revision != layout.revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_REVISION",
                "message": (
                    f"The document is at revision {layout.revision}, not {base_revision}. "
                    "Read the map again and resend the operations."
                ),
                "revision": layout.revision,
            },
        )


def _component_ids(content: dict) -> set[str]:
    return {c.get("id") for c in content.get("components", []) if isinstance(c, dict)}


def _changed_components(before: dict, after: dict) -> list[str]:
    """Components a whole-document replace changed on purpose (new or different)."""
    old = {c.get("id"): c for c in before.get("components", []) if isinstance(c, dict)}
    return [c.get("id") for c in after.get("components", []) if isinstance(c, dict) and old.get(c.get("id")) != c]


async def _save(
    db: AsyncSession,
    request: Request,
    doc: Document,
    layout: DocumentLayout,
    content: dict,
    description: str,
    user: User,
    ops: list[dict] | None,
    changes: list[dict],
) -> int:
    """Compare-and-swap on the revision, so two concurrent writers can't both win.
    Stores the revision and turns the write's side effects into notices."""
    expected = layout.revision
    revision = expected + 1
    api_key_id = getattr(request.state, "api_key_id", None)
    user_id = user.id
    result = await db.execute(
        update(DocumentLayout)
        .where(DocumentLayout.document_id == doc.id, DocumentLayout.revision == expected)
        .values(content=content, revision=revision)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_REVISION",
                "message": "Someone else changed the document while this write was running. Read it again and resend.",
            },
        )
    doc.updated_at = func.now()
    db.add(DocumentLayoutRevision(
        id=uuid.uuid4(),
        document_id=doc.id,
        revision=revision,
        ops=ops,
        content=content,
        author_user_id=user_id,
        api_key_id=api_key_id,
        description=description,
    ))
    notices = await record_changes(db, doc.id, revision, changes, _component_ids(content), user_id, api_key_id)
    await db_service.log_activity(db, doc.id, "layout_updated", description=description, api_key_id=api_key_id)
    await db.commit()
    sse_service.publish(str(doc.id), SSEEvent(
        type="document_updated",
        payload={"doc_id": str(doc.id), "kind": "layout", "revision": revision, "notices": len(notices)},
    ))
    return revision


@router.get("/layout-templates")
async def list_layout_templates(current_user: User = Depends(get_current_user)):
    """Curated starting points for layout documents (slug, title, description)."""
    return {"templates": layout_templates.list_templates()}


@router.post("/layout-documents", response_model=LayoutWriteResponse, status_code=201)
async def create_layout_document(
    request: Request,
    payload: LayoutDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a layout document. Uses one weekly document creation, like the editor."""
    from app.services import tiers as tiers_service
    from app.services.credits import consume_document_creation, refund_document_creation

    limit_error = await tiers_service.check_document_limit(db, current_user)
    if limit_error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=limit_error)

    content = layout_templates.template_document(payload.template, payload.title) if payload.template else payload.content
    meta = content.get("meta") if content else None
    meta_title = meta.get("title") if isinstance(meta, dict) else None
    title = payload.title or meta_title or f"Layout — {datetime.datetime.now(datetime.UTC).strftime('%b %d, %Y')}"
    if content is None:
        content = layout_service.starter_document(title, payload.format or "page")

    # Validate before spending a creation: an unusable document is never stored.
    check = await layout_service.validate(content)
    if not check["ok"]:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_LAYOUT",
                "message": "The layout document has errors; nothing was created.",
                "diagnostics": _errors(check["diagnostics"]),
            },
        )

    api_key_id = getattr(request.state, "api_key_id", None)
    # Read before the try: after a rollback the user instance is expired, and
    # loading it again in the except block would raise and hide the real error.
    user_id = current_user.id
    await consume_document_creation(db, current_user)
    try:
        doc = Document(
            title=title,
            user_id=user_id,
            document_mode=LAYOUT_MODE,
        )
        db.add(doc)
        await db.flush()
        db.add(DocumentLayout(document_id=doc.id, content=content, revision=1))
        db.add(DocumentLayoutRevision(
            id=uuid.uuid4(),
            document_id=doc.id,
            revision=1,
            ops=None,
            content=content,
            author_user_id=user_id,
            api_key_id=api_key_id,
            description="Created",
        ))
        await db_service.log_activity(
            db, doc.id, "document_created",
            description="Layout document created",
            api_key_id=api_key_id,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        await refund_document_creation(db, user_id)
        raise

    if api_key_id:
        capture_event(str(user_id), str(doc.id), "mcp_layout_document_created", {"has_content": payload.content is not None})
    _track(
        request, user_id, doc.id, "layout_document_created",
        {
            "template": payload.template or ("content" if payload.content is not None else "blank"),
            "format": "slide" if any(s.get("size") == "Slide" for s in content.get("surfaces", [])) else "page",
            "components": len(content.get("components", [])),
        },
    )
    logger.info("[layout] document created | doc_id={} user_id={}", doc.id, user_id)
    return LayoutWriteResponse(
        document_id=str(doc.id),
        ok=True,
        revision=1,
        diagnostics=check["diagnostics"],
        map=check["map"],
    )


async def _revision_content(db: AsyncSession, layout: DocumentLayout, revision: int) -> tuple[dict, datetime.datetime | None]:
    """The document as it was at `revision` (the current one comes from the layout row)."""
    if revision == layout.revision:
        return layout.content, layout.updated_at
    row = (
        await db.execute(
            select(DocumentLayoutRevision).where(
                DocumentLayoutRevision.document_id == layout.document_id,
                DocumentLayoutRevision.revision == revision,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Revision {revision} does not exist (the document is at {layout.revision}).")
    return row.content, row.created_at


@router.get("/documents/{document_id}/layout", response_model=LayoutStateResponse)
async def get_layout(
    document_id: uuid.UUID,
    revision: int | None = Query(default=None, ge=1, description="A past revision; default: the current one."),
    format: int | None = Query(default=None, description="The format version the reader's library reads; older ones get the document converted down."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc, layout = await _load(db, document_id, current_user, "read")
    at = revision or layout.revision
    content, when = await _revision_content(db, layout, at)
    content, notes = await layout_service.for_reader(content, format)
    return LayoutStateResponse(
        document_id=str(document_id),
        content=content,
        revision=at,
        updated_at=when,
        title=doc.title,
        notes=notes,
    )


# ─── Publishing ──────────────────────────────────────────────
# "Publish" takes a snapshot that the public link serves; edits after it stay
# private until the next one. Unpublishing clears the snapshot and the token, so
# every link already shared stops working (revocation is real, not cosmetic).


def _publish_state(document_id: uuid.UUID, doc: Document, layout: DocumentLayout) -> LayoutPublishState:
    published = layout.published_content is not None and bool(doc.public_token)
    return LayoutPublishState(
        document_id=str(document_id),
        published=published,
        token=doc.public_token if published else None,
        revision=layout.published_revision if published else None,
        published_at=layout.published_at if published else None,
        current_revision=layout.revision,
    )


@router.get("/documents/{document_id}/layout/publish", response_model=LayoutPublishState)
async def get_layout_publication(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc, layout = await _load(db, document_id, current_user, "manage")
    return _publish_state(document_id, doc, layout)


@router.post("/documents/{document_id}/layout/publish", response_model=LayoutPublishState)
async def publish_layout(
    request: Request,
    document_id: uuid.UUID,
    body: LayoutPublishRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish a revision (default: the current one). The token is kept across
    publishes, so a link already shared shows the new version."""
    doc, layout = await _load(db, document_id, current_user, "manage")
    revision = (body.revision if body else None) or layout.revision
    content, _ = await _revision_content(db, layout, revision)
    if not doc.public_token:
        doc.public_token = secrets.token_urlsafe(24)
    now = datetime.datetime.now(datetime.UTC)
    # Publishing is not an edit: keep updated_at as it was.
    await db.execute(
        update(DocumentLayout)
        .where(DocumentLayout.document_id == document_id)
        .values(published_content=content, published_revision=revision, published_at=now, updated_at=DocumentLayout.updated_at)
    )
    await db_service.log_activity(
        db, document_id, "layout_published", description=f"Published revision {revision}",
        api_key_id=getattr(request.state, "api_key_id", None),
    )
    await db.commit()
    await db.refresh(layout)
    _track(request, current_user.id, document_id, "layout_published", {"revision": revision, "behind": layout.revision - revision})
    return _publish_state(document_id, doc, layout)


@router.delete("/documents/{document_id}/layout/publish", response_model=LayoutPublishState)
async def unpublish_layout(
    request: Request,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc, layout = await _load(db, document_id, current_user, "manage")
    doc.public_token = None
    await db.execute(
        update(DocumentLayout)
        .where(DocumentLayout.document_id == document_id)
        .values(published_content=None, published_revision=None, published_at=None, updated_at=DocumentLayout.updated_at)
    )
    await db_service.log_activity(
        db, document_id, "layout_unpublished", description="Unpublished; the public link was revoked",
        api_key_id=getattr(request.state, "api_key_id", None),
    )
    await db.commit()
    await db.refresh(layout)
    _track(request, current_user.id, document_id, "layout_unpublished")
    return _publish_state(document_id, doc, layout)


async def published_layout(db: AsyncSession, token: str) -> tuple[Document, DocumentLayout] | None:
    """The document behind a public token, when it is a published layout document."""
    row = (
        await db.execute(
            select(Document, DocumentLayout)
            .join(DocumentLayout, DocumentLayout.document_id == Document.id)
            .where(Document.public_token == token, Document.document_mode == LAYOUT_MODE)
        )
    ).first()
    if row is None or row[1].published_content is None:
        return None
    return row[0], row[1]


# Public reads, per client IP: generous for a page that loads a few documents,
# low enough that a loop cannot keep the layout service busy.
PUBLIC_READS_PER_MINUTE = 120
_public_reads: dict[str, deque[float]] = {}


def _client_ip(request: Request) -> str:
    # Behind Caddy the last X-Forwarded-For entry is the address Caddy saw.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _limit_public_reads(request: Request) -> None:
    now = time.monotonic()
    hits = _public_reads.setdefault(_client_ip(request), deque())
    while hits and now - hits[0] > 60:
        hits.popleft()
    if len(hits) >= PUBLIC_READS_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Too many reads from this address; try again in a minute.", headers={"Retry-After": "60"})
    hits.append(now)
    if len(_public_reads) > 10_000:
        for ip in [ip for ip, q in _public_reads.items() if not q or now - q[-1] > 60]:
            del _public_reads[ip]


@router.get("/public/{token}/layout")
async def read_public_layout(
    token: str,
    request: Request,
    format: int | None = Query(default=None, description="The format version the reader's library reads."),
    db: AsyncSession = Depends(get_db),
):
    """The published version of a layout document, for @docforge-lib/layout
    (`fetchPublished`). No authentication: the token is the capability. Any site
    may read it (CORS *); the ETag lets readers revalidate without downloading."""
    _limit_public_reads(request)
    headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag"}
    found = await published_layout(db, token)
    if found is None:
        raise HTTPException(status_code=404, detail="Not found", headers=headers)
    doc, layout = found
    target = layout_service.served_format(format)
    stamp = int(layout.published_at.timestamp()) if layout.published_at else 0
    etag = f'"{doc.id.hex[:12]}-{layout.published_revision}-{stamp}-f{target}"'
    headers |= {"ETag": etag, "Cache-Control": "public, max-age=60"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    content, notes = await layout_service.for_reader(layout.published_content, format)
    capture_event(str(doc.user_id), str(doc.id), "layout_public_read", {"source": "public", "format": target, "downgraded": bool(notes)})
    return JSONResponse(
        {
            "document_id": str(doc.id),
            "title": doc.title,
            "revision": layout.published_revision,
            "published_at": layout.published_at.isoformat() if layout.published_at else None,
            "content": content,
            "notes": notes,
        },
        headers=headers,
    )


async def _open_note_counts(db: AsyncSession, document_id: uuid.UUID) -> dict[str, int]:
    rows = (
        await db.execute(
            select(LayoutNote.kind, func.count())
            .where(LayoutNote.document_id == document_id, LayoutNote.status == "open")
            .group_by(LayoutNote.kind)
        )
    ).all()
    return {kind: count for kind, count in rows}


@router.get("/documents/{document_id}/layout/map", response_model=LayoutMapResponse)
async def get_layout_map(
    document_id: uuid.UUID,
    level: int = Query(default=1, ge=0, le=2),
    components: str | None = Query(default=None, description="Comma-separated component ids (level 2)."),
    pages: str | None = Query(default=None, description="Comma-separated 1-based pages (level 1)."),
    draw: bool | None = Query(default=None, description="Level 1: false leaves out the ASCII drawing."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, layout = await _load(db, document_id, current_user, "read")
    ids = [c.strip() for c in components.split(",") if c.strip()] if components else None
    result = await layout_service.document_map(layout.content, level, ids, _int_list(pages, "pages"), draw)
    counts = await _open_note_counts(db, document_id)
    return LayoutMapResponse(
        document_id=str(document_id),
        revision=layout.revision,
        level=result["level"],
        text=result["text"],
        open_notices=counts.get("notice", 0),
        open_annotations=counts.get("annotation", 0),
    )


@router.get("/documents/{document_id}/layout/find", response_model=LayoutFindResponse)
async def find_in_layout(
    document_id: uuid.UUID,
    text: str | None = Query(default=None, max_length=200),
    type: str | None = Query(default=None, description="Comma-separated component types."),
    label: str | None = Query(default=None, max_length=100),
    page: int | None = Query(default=None, ge=1),
    rect: str | None = Query(default=None, description="page,x,y,w,h in grid units (page 0 = any page)."),
    state: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, layout = await _load(db, document_id, current_user, "read")
    query: dict[str, Any] = {}
    if text:
        query["text"] = text
    if type:
        query["type"] = [t.strip() for t in type.split(",") if t.strip()]
    if label:
        query["label"] = label
    if page is not None:
        query["page"] = page
    if rect:
        values = _int_list(rect, "rect") or []
        if len(values) != 5 or values[3] < 1 or values[4] < 1:
            raise HTTPException(status_code=422, detail="`rect` must be page,x,y,w,h (w and h at least 1; page 0 = any).")
        p, x, y, w, h = values
        query["rect"] = {"x": x, "y": y, "w": w, "h": h, **({"page": p} if p else {})}
    if state:
        if state not in FIND_STATES:
            raise HTTPException(status_code=422, detail=f"`state` must be one of {', '.join(sorted(FIND_STATES))}.")
        query["state"] = state
    result = await layout_service.find(layout.content, query)
    return LayoutFindResponse(document_id=str(document_id), revision=layout.revision, matches=result["matches"], text=result["text"])


@router.get("/documents/{document_id}/layout/image", response_model=LayoutImageResponse)
async def render_layout_image(
    request: Request,
    document_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    scale: float = Query(default=0.75, ge=0.25, le=2),
    highlight: str | None = Query(default=None, description="Comma-separated component ids to outline."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One page as a PNG, for agents that can look at the page. Nothing is saved."""
    _, layout = await _load(db, document_id, current_user, "read")
    ids = [c.strip() for c in highlight.split(",") if c.strip()] if highlight else None
    result = await layout_service.render_image(layout.content, page, scale, ids)
    if not result.get("png"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The layout service cannot draw images (resvg is not installed).")
    _track(request, current_user.id, document_id, "layout_page_rendered", {"page": page, "scale": scale, "highlight": len(ids or [])})
    return LayoutImageResponse(
        document_id=str(document_id),
        revision=layout.revision,
        page=result["page"],
        pages=result["pages"],
        png=result["png"],
        width=result["width"],
        height=result["height"],
    )


@router.get("/documents/{document_id}/layout/review", response_model=LayoutReviewResponse)
async def review_layout(
    request: Request,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What a reader would notice: empty boxes, ragged rows, edges off the guides,
    a near-empty last page. Each finding carries the ops that fix it. Nothing is saved."""
    _, layout = await _load(db, document_id, current_user, "read")
    result = await layout_service.review(layout.content)
    codes = sorted({f.get("code", "") for f in result["findings"]})
    _track(request, current_user.id, document_id, "layout_reviewed", {"findings": len(result["findings"]), "codes": ",".join(codes)})
    return LayoutReviewResponse(document_id=str(document_id), revision=layout.revision, findings=result["findings"], text=result["text"])


@router.post("/documents/{document_id}/layout/ops", response_model=LayoutWriteResponse)
async def apply_layout_ops(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutOpsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply operations. Refused (nothing saved) only for an unusable op or result."""
    doc, layout = await _load(db, document_id, current_user, "write")
    _check_revision(layout, payload.base_revision)

    result = await layout_service.apply(layout.content, payload.ops, payload.pages, payload.draw)
    if not result["ok"] or result.get("doc") is None:
        return LayoutWriteResponse(
            document_id=str(document_id),
            ok=False,
            revision=layout.revision,
            diagnostics=result["diagnostics"],
            map=result.get("map", ""),
            summary=result.get("summary", ""),
        )

    count = len(payload.ops)
    changes = result.get("changes", [])
    revision = await _save(
        db, request, doc, layout, result["doc"],
        description=payload.note or f"{count} layout operation{'s' if count != 1 else ''}",
        user=current_user,
        ops=payload.ops,
        changes=changes,
    )
    op_types = sorted({str(op.get("op")) for op in payload.ops if isinstance(op, dict)})
    _track(
        request, current_user.id, document_id, "layout_write",
        {"ops": count, "op_types": ",".join(op_types), "side_effects": len(changes), "has_note": bool(payload.note), "revision": revision},
    )
    return LayoutWriteResponse(
        document_id=str(document_id),
        ok=True,
        revision=revision,
        diagnostics=result["diagnostics"],
        changes=changes,
        map=result["map"],
        summary=result.get("summary", ""),
    )


@router.post("/documents/{document_id}/layout/preview", response_model=LayoutPreviewResponse)
async def preview_layout_ops(
    document_id: uuid.UUID,
    payload: LayoutOpsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What these operations would do to the stored document. Nothing is saved."""
    _, layout = await _load(db, document_id, current_user, "read")
    _check_revision(layout, payload.base_revision)
    result = await layout_service.apply(layout.content, payload.ops, payload.pages, payload.draw)
    return LayoutPreviewResponse(
        ok=result["ok"],
        base_revision=layout.revision,
        diagnostics=result["diagnostics"],
        changes=result.get("changes", []),
        map=result.get("map", ""),
        summary=result.get("summary", ""),
    )


@router.post("/layout/preview", response_model=LayoutPreviewResponse)
async def preview_layout_document(
    payload: LayoutPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Lay out a document that is not stored (optionally after operations). Nothing is saved."""
    if payload.ops:
        result = await layout_service.apply(payload.content, payload.ops, payload.pages, payload.draw)
        return LayoutPreviewResponse(
            ok=result["ok"],
            diagnostics=result["diagnostics"],
            changes=result.get("changes", []),
            map=result.get("map", ""),
            summary=result.get("summary", ""),
            content=result.get("doc"),
        )
    check = await layout_service.validate(payload.content)
    text = check["map"]
    if payload.pages or payload.draw is not None:
        text = (await layout_service.document_map(payload.content, 1, None, payload.pages, payload.draw))["text"]
    return LayoutPreviewResponse(ok=check["ok"], diagnostics=check["diagnostics"], map=text, content=payload.content)


@router.post("/layout/measure", response_model=LayoutMeasureResponse)
async def measure_layout_component(
    payload: LayoutMeasureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """How big a component would be at one or more widths. Nothing is saved."""
    doc_content = payload.content
    if payload.document_id:
        try:
            doc_id = uuid.UUID(payload.document_id)
        except ValueError as e:
            raise HTTPException(status_code=422, detail="`document_id` is not a valid id.") from e
        _, layout = await _load(db, doc_id, current_user, "read")
        doc_content = layout.content
    result = await layout_service.measure(payload.component, doc_content, payload.widths, payload.cols)
    return LayoutMeasureResponse(**result)


@router.post("/documents/{document_id}/layout/calibrate", response_model=LayoutCalibrateResponse)
async def calibrate_layout_style(
    document_id: uuid.UUID,
    payload: LayoutCalibrateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Style variants for a component, class or selector, measured side by side. Nothing is saved."""
    _, layout = await _load(db, document_id, current_user, "read")
    target = {k: v for k, v in {"component": payload.component, "label": payload.label, "selector": payload.selector}.items() if v is not None}
    result = await layout_service.calibrate(layout.content, target, payload.variants)
    return LayoutCalibrateResponse(document_id=str(document_id), revision=layout.revision, **result)


@router.put("/documents/{document_id}/layout", response_model=LayoutWriteResponse)
async def replace_layout(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutReplaceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the whole layout document. Refused only if it cannot be used."""
    doc, layout = await _load(db, document_id, current_user, "write")
    _check_revision(layout, payload.base_revision)

    check = await layout_service.validate(payload.content)
    if not check["ok"]:
        return LayoutWriteResponse(
            document_id=str(document_id),
            ok=False,
            revision=layout.revision,
            diagnostics=check["diagnostics"],
            map=check["map"],
        )

    changes = await layout_service.diff(layout.content, payload.content, _changed_components(layout.content, payload.content))
    revision = await _save(
        db, request, doc, layout, payload.content,
        description="Layout replaced",
        user=current_user,
        ops=None,
        changes=changes,
    )
    # The editor replaces the whole document for undo, redo, "undo all" and restoring a version.
    _track(request, current_user.id, document_id, "layout_replaced", {"side_effects": len(changes), "revision": revision})
    return LayoutWriteResponse(
        document_id=str(document_id),
        ok=True,
        revision=revision,
        diagnostics=check["diagnostics"],
        changes=changes,
        map=check["map"],
    )


# ─── Notes (notices and annotations) ─────────────────────────


Author = tuple[str | None, str | None]


async def _authors(db: AsyncSession, rows: list) -> dict[uuid.UUID, Author]:
    """(name, harness) for each row's author: the agent's key if it has one, else the person."""
    people, agents = await actor.names_for(
        db, {r.author_user_id for r in rows if r.author_user_id}, {r.api_key_id for r in rows if r.api_key_id}
    )
    out: dict[uuid.UUID, Author] = {}
    for r in rows:
        if r.api_key_id and r.api_key_id in agents:
            out[r.id] = agents[r.api_key_id]
        elif r.author_user_id:
            out[r.id] = (people.get(r.author_user_id), None)
    return out


def _note_response(note: LayoutNote, located: dict | None = None, author: Author | None = None) -> LayoutNoteResponse:
    return LayoutNoteResponse(
        id=str(note.id),
        document_id=str(note.document_id),
        kind=note.kind,
        code=note.code,
        severity=note.severity,
        anchor=note.anchor or {},
        message=note.message,
        data=note.data,
        revision=note.revision,
        author_user_id=note.author_user_id,
        by_agent=note.api_key_id is not None,
        author_name=author[0] if author else None,
        harness=author[1] if author else None,
        status=note.status,
        resolution_note=note.resolution_note,
        created_at=note.created_at,
        resolved_at=note.resolved_at,
        parent_id=str(note.parent_id) if note.parent_id else None,
        for_agent=bool(note.for_agent),
        where=located.get("text") if located else None,
        located=located,
    )


@router.get("/documents/{document_id}/layout/notes", response_model=LayoutNotesResponse)
async def list_layout_notes(
    document_id: uuid.UUID,
    status_filter: str = Query(default="open", alias="status", pattern="^(open|acknowledged|resolved|all)$"),
    kind: str | None = Query(default=None, pattern="^(notice|annotation)$"),
    component: str | None = Query(default=None, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Notes with their anchors resolved against the current layout."""
    _, layout = await _load(db, document_id, current_user, "read")
    query = select(LayoutNote).where(LayoutNote.document_id == document_id)
    if kind:
        query = query.where(LayoutNote.kind == kind)
    every = list((await db.execute(query.order_by(LayoutNote.revision, LayoutNote.created_at))).scalars())
    # The status filter picks threads by their root; a reply always follows its root.
    roots = [n for n in every if n.parent_id is None and (status_filter == "all" or n.status == status_filter)]
    if component:
        roots = [n for n in roots if (n.anchor or {}).get("component") == component]
    kept = {n.id for n in roots}
    notes = [n for n in every if n.id in kept or (n.parent_id is not None and n.parent_id in kept)]

    located: list[dict | None] = [None] * len(notes)
    anchored = [i for i, n in enumerate(notes) if n.anchor]
    if anchored:
        try:
            found = await layout_service.locate(layout.content, [notes[i].anchor for i in anchored])
            for i, where in zip(anchored, found, strict=False):
                located[i] = where
        except HTTPException as e:
            # Notes stay readable without the layout service; only positions are missing.
            if e.status_code != status.HTTP_503_SERVICE_UNAVAILABLE:
                raise
    authors = await _authors(db, notes)
    return LayoutNotesResponse(
        document_id=str(document_id),
        revision=layout.revision,
        notes=[_note_response(n, located[i], authors.get(n.id)) for i, n in enumerate(notes)],
    )


@router.post("/documents/{document_id}/layout/notes", response_model=LayoutNoteResponse, status_code=201)
async def create_layout_annotation(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """An annotation on a component and/or an area of the grid."""
    _, layout = await _load(db, document_id, current_user, "comment")
    parent: LayoutNote | None = None
    if payload.parent_id:
        try:
            parent = await db.get(LayoutNote, uuid.UUID(payload.parent_id))
        except ValueError:
            parent = None
        if parent is None or parent.document_id != document_id:
            raise HTTPException(status_code=404, detail="The note this replies to was not found.")
        if parent.parent_id is not None:
            parent = await db.get(LayoutNote, parent.parent_id)  # replies attach to the thread's root
    anchor = payload.anchor.model_dump(exclude_none=True) if payload.anchor else {}
    if parent is not None and not anchor:
        anchor = dict(parent.anchor or {})
    if "rect" in anchor:
        anchor["rect"] = {k: v for k, v in anchor["rect"].items() if v is not None}
    data: dict | None = None
    if payload.code == "review-request":
        data = (payload.review or LayoutReviewData()).model_dump()
    elif payload.code == "review-answer":
        data = {"answers": payload.answers or {}, "request_id": payload.request_id}
    note = LayoutNote(
        id=uuid.uuid4(),
        document_id=document_id,
        kind="annotation",
        code=payload.code,
        severity="info",
        anchor=anchor,
        data=data,
        message=payload.message,
        revision=layout.revision,
        author_user_id=current_user.id,
        api_key_id=getattr(request.state, "api_key_id", None),
        status="open",
        parent_id=parent.id if parent is not None else None,
        for_agent=payload.for_agent and parent is None,
    )
    db.add(note)
    if parent is not None and parent.status == "resolved":
        # Answering a closed thread opens it again.
        parent.status = "open"
        parent.resolved_at = None
    await db.commit()
    await db.refresh(note)
    sse_service.publish(str(document_id), SSEEvent(type="layout_note_changed", payload={"doc_id": str(document_id), "note_id": str(note.id)}))
    if payload.code == "review-request":
        review = payload.review or LayoutReviewData()
        _track(request, current_user.id, document_id, "layout_review_requested", {"questions": len(review.questions), "focus": len(review.focus)})
    elif payload.code == "review-answer":
        minutes = None
        if payload.request_id:
            try:
                asked = await db.get(LayoutNote, uuid.UUID(payload.request_id))
            except ValueError:
                asked = None
            if asked is not None and asked.created_at is not None and note.created_at is not None:
                minutes = round((note.created_at - asked.created_at).total_seconds() / 60, 1)
        _track(request, current_user.id, document_id, "layout_review_answered", {"answers": len(payload.answers or {}), "minutes_to_answer": minutes})
    elif parent is not None:
        _track(request, current_user.id, document_id, "layout_note_replied", {"to_agent_request": bool(parent.for_agent), "thread_by_agent": parent.api_key_id is not None})
    else:
        _track(
            request, current_user.id, document_id, "layout_annotation_created",
            {"anchor": "rect" if "rect" in anchor else "component" if anchor.get("component") else "document", "for_agent": bool(payload.for_agent)},
        )
    return _note_response(note, author=(await _authors(db, [note])).get(note.id))


@router.patch("/layout-notes/{note_id}", response_model=LayoutNoteResponse)
async def update_layout_note(
    request: Request,
    note_id: uuid.UUID,
    payload: LayoutNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge, resolve or reopen a note."""
    note = await db.get(LayoutNote, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    await _load(db, note.document_id, current_user, "comment")
    if payload.status is not None:
        note.status = payload.status
        note.resolution_note = payload.resolution_note
        note.resolved_at = datetime.datetime.now(datetime.UTC) if payload.status == "resolved" else None
    if payload.for_agent is not None and note.parent_id is None:
        note.for_agent = payload.for_agent
    await db.commit()
    await db.refresh(note)
    sse_service.publish(str(note.document_id), SSEEvent(type="layout_note_changed", payload={"doc_id": str(note.document_id), "note_id": str(note.id)}))
    _track(
        request, current_user.id, note.document_id, "layout_note_status",
        {"status": payload.status or note.status, "kind": note.kind, "code": note.code or "", "for_agent": bool(note.for_agent)},
    )
    return _note_response(note, author=(await _authors(db, [note])).get(note.id))


# ─── Revisions and saved versions ────────────────────────────


def _ops_summary(ops: list | None) -> dict[str, Any] | None:
    """What a write did, from its ops: counts by op and the components it named."""
    if not ops:
        return None
    counts: dict[str, int] = {}
    components: list[str] = []
    for op in ops:
        if not isinstance(op, dict):
            continue
        name = str(op.get("op"))
        counts[name] = counts.get(name, 0) + 1
        target = op.get("component")
        ids = [target.get("id")] if isinstance(target, dict) else [target]
        if name == "row":
            ids = [i if isinstance(i, str) else (i or {}).get("id") for i in op.get("items") or []]
        for cid in ids:
            if isinstance(cid, str) and cid not in components:
                components.append(cid)
    return {"ops": counts, "components": components[:20]}


def _revision_item(r: DocumentLayoutRevision, author: Author | None = None) -> LayoutRevisionItem:
    return LayoutRevisionItem(
        revision=r.revision,
        description=r.description,
        ops_count=len(r.ops) if r.ops is not None else None,
        author_user_id=r.author_user_id,
        by_agent=r.api_key_id is not None,
        author_name=author[0] if author else None,
        harness=author[1] if author else None,
        created_at=r.created_at,
        name=r.name,
        note=r.note,
        summary=_ops_summary(r.ops),
    )


async def _revision_row(db: AsyncSession, document_id: uuid.UUID, revision: int) -> DocumentLayoutRevision:
    row = (
        await db.execute(
            select(DocumentLayoutRevision).where(
                DocumentLayoutRevision.document_id == document_id,
                DocumentLayoutRevision.revision == revision,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Revision not found")
    return row


@router.get("/documents/{document_id}/layout/revisions", response_model=LayoutRevisionsResponse)
async def list_layout_revisions(
    document_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=500),
    named: bool = Query(default=False, description="Only saved versions (revisions with a name)."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The edit timeline, newest first: every accepted write, with its saved-version name if it has one."""
    _, layout = await _load(db, document_id, current_user, "read")
    query = select(DocumentLayoutRevision).where(DocumentLayoutRevision.document_id == document_id)
    if named:
        query = query.where(DocumentLayoutRevision.name.is_not(None))
    rows = list((await db.execute(query.order_by(DocumentLayoutRevision.revision.desc()).limit(limit))).scalars())
    authors = await _authors(db, rows)
    return LayoutRevisionsResponse(
        document_id=str(document_id),
        revision=layout.revision,
        revisions=[_revision_item(r, authors.get(r.id)) for r in rows],
    )


@router.get("/documents/{document_id}/layout/revisions/{revision}", response_model=LayoutRevisionResponse)
async def get_layout_revision(
    document_id: uuid.UUID,
    revision: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load(db, document_id, current_user, "read")
    row = await _revision_row(db, document_id, revision)
    return LayoutRevisionResponse(
        document_id=str(document_id),
        revision=row.revision,
        content=row.content,
        ops=row.ops,
        description=row.description,
        created_at=row.created_at,
        name=row.name,
        note=row.note,
        by_agent=row.api_key_id is not None,
    )


@router.post("/documents/{document_id}/layout/versions", response_model=LayoutRevisionItem, status_code=201)
async def save_layout_version(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a version: give the current revision (or `revision`) a name and a note. Nothing is copied."""
    _, layout = await _load(db, document_id, current_user, "write")
    row = await _revision_row(db, document_id, payload.revision or layout.revision)
    row.name = payload.name.strip()
    row.note = (payload.note or "").strip() or None
    await db.commit()
    await db.refresh(row)
    await db_service.log_activity(db, document_id, "snapshot", description=f"Version saved: {row.name}", api_key_id=getattr(request.state, "api_key_id", None))
    await db.commit()
    sse_service.publish(str(document_id), SSEEvent(type="layout_version_saved", payload={"doc_id": str(document_id), "revision": row.revision}))
    _track(request, current_user.id, document_id, "layout_version_saved", {"revision": row.revision, "has_note": bool(row.note), "behind": layout.revision - row.revision})
    return _revision_item(row, (await _authors(db, [row])).get(row.id))


@router.patch("/documents/{document_id}/layout/revisions/{revision}", response_model=LayoutRevisionItem)
async def update_layout_revision(
    request: Request,
    document_id: uuid.UUID,
    revision: int,
    payload: LayoutRevisionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename a saved version or change its note; `name: null` takes it off the saved list."""
    await _load(db, document_id, current_user, "write")
    row = await _revision_row(db, document_id, revision)
    fields = payload.model_fields_set
    if "name" in fields:
        row.name = (payload.name or "").strip() or None
    if "note" in fields:
        row.note = (payload.note or "").strip() or None
    await db.commit()
    await db.refresh(row)
    sse_service.publish(str(document_id), SSEEvent(type="layout_version_saved", payload={"doc_id": str(document_id), "revision": row.revision}))
    _track(request, current_user.id, document_id, "layout_version_updated", {"revision": row.revision, "unsaved": row.name is None})
    return _revision_item(row, (await _authors(db, [row])).get(row.id))


# ─── Themes ──────────────────────────────────────────────────


def _theme_response(theme: LayoutTheme) -> LayoutThemeResponse:
    return LayoutThemeResponse(
        id=str(theme.id),
        name=theme.name,
        description=theme.description,
        builtin=False,
        by_agent=theme.api_key_id is not None,
        tokens=theme.tokens,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
    )


async def _check_tokens(tokens: dict[str, Any]) -> dict[str, Any]:
    """Tokens a document would accept (the layout service checks them), with only known groups."""
    allowed = {"color", "font", "size", "space", "radius", "lineHeight"}
    unknown = sorted(set(tokens) - allowed)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown token groups: {', '.join(unknown)}. Use {', '.join(sorted(allowed))}.")
    fonts = (tokens.get("font") or {}).values()
    missing = sorted({f for f in fonts if f not in layout_themes.FONT_FAMILIES})
    if missing:
        raise HTTPException(status_code=422, detail=f"Fonts not available: {', '.join(missing)}. Use {', '.join(layout_themes.FONT_FAMILIES)}.")
    probe = layout_service.starter_document("theme")
    probe["tokens"] = tokens
    check = await layout_service.validate(probe)
    errors = _errors(check["diagnostics"])
    if errors:
        raise HTTPException(status_code=422, detail={"code": "INVALID_TOKENS", "message": "The theme's tokens are not valid.", "diagnostics": errors})
    return tokens


async def _own_theme(db: AsyncSession, theme_id: uuid.UUID, user: User) -> LayoutTheme:
    theme = await db.get(LayoutTheme, theme_id)
    if theme is None or theme.user_id != user.id:
        raise HTTPException(status_code=404, detail="Theme not found")
    return theme


@router.get("/layout-themes", response_model=LayoutThemesResponse)
async def list_layout_themes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Built-in themes first, then the ones this person (or their agents) saved."""
    rows = (await db.execute(select(LayoutTheme).where(LayoutTheme.user_id == current_user.id).order_by(LayoutTheme.created_at))).scalars()
    themes = [LayoutThemeResponse(**t) for t in layout_themes.builtin_themes()] + [_theme_response(r) for r in rows]
    return LayoutThemesResponse(themes=themes, fonts=list(layout_themes.FONT_FAMILIES))


@router.post("/layout-themes", response_model=LayoutThemeResponse, status_code=201)
async def create_layout_theme(
    request: Request,
    payload: LayoutThemeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tokens = await _check_tokens(payload.tokens)
    theme = LayoutTheme(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        tokens=tokens,
        api_key_id=getattr(request.state, "api_key_id", None),
    )
    db.add(theme)
    await db.commit()
    await db.refresh(theme)
    capture_account_event(
        str(current_user.id), "layout_theme_saved",
        {"source": "agent" if theme.api_key_id else "person", "groups": ",".join(sorted(tokens)), "colors": len(tokens.get("color") or {})},
    )
    return _theme_response(theme)


@router.patch("/layout-themes/{theme_id}", response_model=LayoutThemeResponse)
async def update_layout_theme(
    theme_id: uuid.UUID,
    payload: LayoutThemeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    theme = await _own_theme(db, theme_id, current_user)
    if payload.name is not None:
        theme.name = payload.name.strip()
    if "description" in payload.model_fields_set:
        theme.description = (payload.description or "").strip() or None
    if payload.tokens is not None:
        theme.tokens = await _check_tokens(payload.tokens)
    await db.commit()
    await db.refresh(theme)
    return _theme_response(theme)


async def _find_theme(db: AsyncSession, ref: str, user: User) -> dict[str, Any]:
    """A theme as a dict (name, tokens) by id, built-in key or name (built-ins first, then saved, case-insensitive)."""
    ref = ref.strip()
    builtin = layout_themes.BUILTIN_BY_ID.get(ref) or layout_themes.BUILTIN_BY_ID.get(f"builtin:{ref}")
    if builtin:
        return builtin
    rows = list((await db.execute(select(LayoutTheme).where(LayoutTheme.user_id == user.id))).scalars())
    for row in rows:
        if str(row.id) == ref:
            return {"name": row.name, "tokens": row.tokens}
    lowered = ref.casefold()
    for theme in layout_themes.BUILTIN_THEMES:
        if theme["name"].casefold() == lowered:
            return theme
    for row in rows:
        if row.name.casefold() == lowered:
            return {"name": row.name, "tokens": row.tokens}
    raise HTTPException(status_code=404, detail=f'Theme "{ref}" not found. List them with GET /layout-themes.')


@router.post("/documents/{document_id}/layout/theme", response_model=LayoutWriteResponse)
async def apply_layout_theme(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutThemeApply,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a theme: one write with its tokens (every color, font and radius) and its name."""
    theme = await _find_theme(db, payload.theme, current_user)
    ops = layout_themes.apply_ops(theme)
    return await apply_layout_ops(request, document_id, LayoutOpsRequest(ops=ops, note=f"Tema: {theme['name']}"), db, current_user)


@router.delete("/layout-themes/{theme_id}", status_code=204)
async def delete_layout_theme(
    theme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    theme = await _own_theme(db, theme_id, current_user)
    await db.delete(theme)
    await db.commit()
