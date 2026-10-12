"""Layout documents — components placed on a grid (@docforge/layout).

A layout document is a `Document` with `document_mode="layout"` whose content
lives in `document_layouts` as one JSON document. The backend never interprets
that JSON: the layout service validates it, applies operations to it and
writes the text map the agent reads. The backend owns what the service cannot:
permissions, storage, revisions and activity.

Writes are all-or-nothing. A write is saved only when the service reports it
ok; otherwise nothing changes and the response carries the diagnostics, so the
agent can fix the operations and send them again.
"""

import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, DocumentLayout
from app.models.user import User
from app.schemas.layout import (
    LayoutDocumentCreate,
    LayoutMapResponse,
    LayoutOpsRequest,
    LayoutReplaceRequest,
    LayoutStateResponse,
    LayoutWriteResponse,
)
from app.schemas.sse import SSEEvent
from app.services import access
from app.services import db as db_service
from app.services import layout as layout_service
from app.services import sse as sse_service
from app.services.observability import capture_event

router = APIRouter(tags=["layout"])

LAYOUT_MODE = "layout"


def _errors(diagnostics: list[dict]) -> list[dict]:
    return [d for d in diagnostics if d.get("severity") == "error"]


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


async def _save(
    db: AsyncSession,
    request: Request,
    doc: Document,
    layout: DocumentLayout,
    content: dict,
    description: str,
) -> int:
    """Compare-and-swap on the revision, so two concurrent writers can't both win."""
    expected = layout.revision
    result = await db.execute(
        update(DocumentLayout)
        .where(DocumentLayout.document_id == doc.id, DocumentLayout.revision == expected)
        .values(content=content, revision=expected + 1)
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
    await db_service.log_activity(
        db, doc.id, "layout_updated",
        description=description,
        api_key_id=getattr(request.state, "api_key_id", None),
    )
    await db.commit()
    revision = expected + 1
    sse_service.publish(str(doc.id), SSEEvent(
        type="document_updated",
        payload={"doc_id": str(doc.id), "kind": "layout", "revision": revision},
    ))
    return revision


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

    content = payload.content
    meta = content.get("meta") if content else None
    meta_title = meta.get("title") if isinstance(meta, dict) else None
    title = payload.title or meta_title or f"Layout — {datetime.datetime.now(datetime.UTC).strftime('%b %d, %Y')}"
    if content is None:
        content = layout_service.starter_document(title)

    # Validate before spending a creation: an invalid document is never stored.
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
    await consume_document_creation(db, current_user)
    try:
        doc = Document(
            title=title,
            document_context="",
            user_id=current_user.id,
            current_phase="editing",
            document_mode=LAYOUT_MODE,
        )
        db.add(doc)
        await db.flush()
        db.add(DocumentLayout(document_id=doc.id, content=content, revision=1))
        await db_service.log_activity(
            db, doc.id, "document_created",
            description="Layout document created",
            api_key_id=api_key_id,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        await refund_document_creation(db, current_user.id)
        raise

    if api_key_id:
        capture_event(str(current_user.id), str(doc.id), "mcp_layout_document_created", {"has_content": payload.content is not None})
    logger.info("[layout] document created | doc_id={} user_id={}", doc.id, current_user.id)
    return LayoutWriteResponse(
        document_id=str(doc.id),
        ok=True,
        revision=1,
        diagnostics=check["diagnostics"],
        map=check["map"],
    )


@router.get("/documents/{document_id}/layout", response_model=LayoutStateResponse)
async def get_layout(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, layout = await _load(db, document_id, current_user, "read")
    return LayoutStateResponse(
        document_id=str(document_id),
        content=layout.content,
        revision=layout.revision,
        updated_at=layout.updated_at,
    )


@router.get("/documents/{document_id}/layout/map", response_model=LayoutMapResponse)
async def get_layout_map(
    document_id: uuid.UUID,
    level: int = Query(default=1, ge=0, le=2),
    components: str | None = Query(default=None, description="Comma-separated component ids (level 2)."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, layout = await _load(db, document_id, current_user, "read")
    ids = [c.strip() for c in components.split(",") if c.strip()] if components else None
    result = await layout_service.document_map(layout.content, level, ids)
    return LayoutMapResponse(
        document_id=str(document_id),
        revision=layout.revision,
        level=result["level"],
        text=result["text"],
    )


@router.post("/documents/{document_id}/layout/ops", response_model=LayoutWriteResponse)
async def apply_layout_ops(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutOpsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply operations. Saved only if the service reports ok; otherwise nothing changes."""
    doc, layout = await _load(db, document_id, current_user, "write")
    _check_revision(layout, payload.base_revision)

    result = await layout_service.apply(layout.content, payload.ops)
    if not result["ok"] or result.get("doc") is None:
        return LayoutWriteResponse(
            document_id=str(document_id),
            ok=False,
            revision=layout.revision,
            diagnostics=result["diagnostics"],
            map=result.get("map", ""),
        )

    count = len(payload.ops)
    revision = await _save(
        db, request, doc, layout, result["doc"],
        description=f"{count} layout operation{'s' if count != 1 else ''}",
    )
    return LayoutWriteResponse(
        document_id=str(document_id),
        ok=True,
        revision=revision,
        diagnostics=result["diagnostics"],
        map=result["map"],
    )


@router.put("/documents/{document_id}/layout", response_model=LayoutWriteResponse)
async def replace_layout(
    request: Request,
    document_id: uuid.UUID,
    payload: LayoutReplaceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the whole layout document. Saved only if it has no errors."""
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

    revision = await _save(db, request, doc, layout, payload.content, description="Layout replaced")
    return LayoutWriteResponse(
        document_id=str(document_id),
        ok=True,
        revision=revision,
        diagnostics=check["diagnostics"],
        map=check["map"],
    )
