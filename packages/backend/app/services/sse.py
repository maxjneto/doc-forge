import asyncio
from collections.abc import AsyncGenerator

from app.schemas.sse import SSEEvent

_registry: dict[str, set[asyncio.Queue]] = {}


def subscribe(doc_id: str) -> "asyncio.Queue[str]":
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=50)
    _registry.setdefault(doc_id, set()).add(q)
    return q


def unsubscribe(doc_id: str, q: "asyncio.Queue[str]") -> None:
    queues = _registry.get(doc_id)
    if queues:
        queues.discard(q)
        if not queues:
            del _registry[doc_id]


def publish(doc_id: str, event: SSEEvent) -> None:
    """Push an event to all active SSE streams for doc_id. Fire-and-forget."""
    queues = _registry.get(doc_id)
    if not queues:
        return
    data = event.model_dump_json()
    for q in list(queues):
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            pass


async def event_stream(doc_id: str) -> AsyncGenerator[str, None]:
    q = subscribe(doc_id)
    try:
        while True:
            try:
                data = await asyncio.wait_for(q.get(), timeout=15.0)
                yield f"data: {data}\n\n"
            except asyncio.TimeoutError:
                yield "event: ping\ndata: {}\n\n"
    except GeneratorExit:
        pass
    finally:
        unsubscribe(doc_id, q)
