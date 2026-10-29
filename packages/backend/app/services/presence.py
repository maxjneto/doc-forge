"""Who is on a document right now.

People: everyone with the document's event stream open. The stream already
exists for live updates, so being connected is being here — no heartbeat of
its own, and a closed tab leaves when its connection drops.

Agents: an agent has no connection to hold, only writes. One that wrote in the
last few minutes is "working on it"; after that it is just a name in the
activity feed.

The registry lives in this process, like the SSE queues without Redis: enough
for the single replica production runs. Scaling out means moving it to Redis
next to the pub/sub.
"""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.sse import SSEEvent
from app.services import actor
from app.services import sse as sse_service

AGENT_WINDOW = datetime.timedelta(minutes=10)


@dataclass
class _Connection:
    user_id: str
    name: str
    since: datetime.datetime


_open: dict[str, dict[str, _Connection]] = {}


def _people(doc_id: str) -> dict[str, _Connection]:
    """One entry per person (several tabs are one person), the earliest arrival."""
    people: dict[str, _Connection] = {}
    for c in _open.get(doc_id, {}).values():
        if c.user_id not in people or c.since < people[c.user_id].since:
            people[c.user_id] = c
    return people


def _announce(doc_id: str) -> None:
    sse_service.publish(doc_id, SSEEvent(type="presence_changed", payload={"doc_id": doc_id}))


def join(doc_id: str, user_id: str, name: str) -> str:
    arriving = user_id not in _people(doc_id)
    connection = uuid.uuid4().hex
    _open.setdefault(doc_id, {})[connection] = _Connection(user_id, name, datetime.datetime.now(datetime.UTC))
    if arriving:
        _announce(doc_id)
    return connection


def leave(doc_id: str, connection: str) -> None:
    conns = _open.get(doc_id)
    if not conns or connection not in conns:
        return
    user_id = conns.pop(connection).user_id
    if not conns:
        del _open[doc_id]
    if user_id not in _people(doc_id):
        _announce(doc_id)


async def snapshot(db: AsyncSession, document_id: uuid.UUID, me: str) -> dict:
    from app.models.document_activity import DocumentActivity

    people = sorted(_people(str(document_id)).values(), key=lambda c: c.since)
    since = datetime.datetime.now(datetime.UTC) - AGENT_WINDOW
    rows = (await db.execute(
        select(DocumentActivity.api_key_id, DocumentActivity.user_id, func.max(DocumentActivity.created_at))
        .where(
            DocumentActivity.document_id == document_id,
            DocumentActivity.api_key_id.is_not(None),
            DocumentActivity.created_at >= since,
        )
        .group_by(DocumentActivity.api_key_id, DocumentActivity.user_id)
    )).all()
    owners, agents = await actor.names_for(db, {u for _, u, _ in rows if u}, {k for k, _, _ in rows})
    return {
        "people": [
            {"id": c.user_id, "name": c.name, "is_me": c.user_id == me, "since": c.since.isoformat()}
            for c in people
        ],
        "agents": [
            {
                "id": str(key_id),
                "name": agents[key_id][0],
                "harness": agents[key_id][1],
                "on_behalf_of": owners.get(user_id) if user_id else None,
                "last_seen": last.isoformat(),
            }
            for key_id, user_id, last in sorted(rows, key=lambda r: r[2], reverse=True)
            if key_id in agents
        ],
    }
