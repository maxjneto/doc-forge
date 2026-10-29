"""Notices: what the layout did on its own, kept until it stops being true.

Every accepted write of a layout document comes back from the layout service
with `changes` — side effects on components the write did not touch (a box
pushed to another page, a table that now splits, the page limit…). They are
stored as `LayoutNote(kind="notice")` so the agent and the person see them
later, not only in the response of the write that caused them.

So the list does not grow forever, a notice lives only while it describes the
current layout:
- a newer change about the same component (or, for page-level codes, the same
  code) supersedes it;
- a change that undoes the effect (`recovery`) resolves it and is not stored;
- a notice about a component that no longer exists is resolved.
Annotations (written by people) are never resolved automatically.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LayoutNote

PAGE_LEVEL_CODES = {"page-count", "page-limit"}


def _same_subject(note: LayoutNote, change: dict[str, Any]) -> bool:
    component = change.get("component")
    if component:
        return (note.anchor or {}).get("component") == component
    return note.code == change.get("code") and not (note.anchor or {}).get("component")


async def record_changes(
    db: AsyncSession,
    document_id: uuid.UUID,
    revision: int,
    changes: list[dict[str, Any]],
    component_ids: set[str],
    author_user_id: str | None,
    api_key_id: uuid.UUID | None,
) -> list[LayoutNote]:
    """Store `changes` as notices and retire the ones they replace. Does not commit."""
    open_notices = list(
        (
            await db.execute(
                select(LayoutNote).where(
                    LayoutNote.document_id == document_id,
                    LayoutNote.kind == "notice",
                    LayoutNote.status == "open",
                )
            )
        ).scalars()
    )
    now = datetime.datetime.now(datetime.UTC)

    def resolve(note: LayoutNote, why: str) -> None:
        note.status = "resolved"
        note.resolution_note = why
        note.resolved_at = now

    for note in open_notices:
        component = (note.anchor or {}).get("component")
        if component and component not in component_ids:
            resolve(note, f"Revision {revision}: the component is no longer in the document.")

    created: list[LayoutNote] = []
    for change in changes:
        for note in open_notices:
            if note.status == "open" and _same_subject(note, change):
                resolve(
                    note,
                    f"Revision {revision}: {change.get('message', '')}".strip()
                    if change.get("recovery")
                    else f"Superseded by revision {revision}.",
                )
        if change.get("recovery"):
            continue
        component = change.get("component")
        note = LayoutNote(
            id=uuid.uuid4(),
            document_id=document_id,
            kind="notice",
            code=change.get("code"),
            severity=change.get("severity", "info"),
            anchor={"component": component} if component else {},
            message=change.get("message", ""),
            data=change.get("data"),
            revision=revision,
            author_user_id=author_user_id,
            api_key_id=api_key_id,
            status="open",
        )
        db.add(note)
        created.append(note)
    return created
