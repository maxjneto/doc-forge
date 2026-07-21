"""SSE event distribution.

Default: in-process queues (single replica). When REDIS_URL is configured,
events are published through Redis pub/sub so any replica can deliver them to
its connected SSE streams — required for scale-out beyond replica=1.
"""

import asyncio
from collections.abc import AsyncGenerator

from loguru import logger

from app.config import settings
from app.schemas.sse import SSEEvent

_registry: dict[str, set[asyncio.Queue]] = {}

_CHANNEL_PREFIX = "docforge:sse:"
_redis = None
_listener_task: asyncio.Task | None = None


def _redis_client():
    global _redis
    if _redis is None and settings.REDIS_URL:
        import redis.asyncio as aioredis

        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _deliver_local(doc_id: str, data: str) -> None:
    queues = _registry.get(doc_id)
    if not queues:
        return
    for q in list(queues):
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            pass


async def _listen() -> None:
    """Background task: fan Redis messages out to this replica's local queues."""
    client = _redis_client()
    pubsub = client.pubsub()
    await pubsub.psubscribe(_CHANNEL_PREFIX + "*")
    logger.info("[sse] redis listener started")
    try:
        async for message in pubsub.listen():
            if message.get("type") != "pmessage":
                continue
            channel = str(message.get("channel", ""))
            doc_id = channel[len(_CHANNEL_PREFIX):]
            _deliver_local(doc_id, str(message.get("data", "")))
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.warning("[sse] redis listener died ({}); will restart on next subscribe", e)


def _ensure_listener() -> None:
    global _listener_task
    if not settings.REDIS_URL:
        return
    if _listener_task is None or _listener_task.done():
        _listener_task = asyncio.get_running_loop().create_task(_listen())


async def _publish_redis(doc_id: str, data: str) -> None:
    try:
        await _redis_client().publish(_CHANNEL_PREFIX + doc_id, data)
    except Exception as e:
        logger.warning("[sse] redis publish failed ({}); delivering in-process", e)
        _deliver_local(doc_id, data)


def subscribe(doc_id: str) -> "asyncio.Queue[str]":
    _ensure_listener()
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
    """Push an event to all active SSE streams for doc_id. Fire-and-forget.

    With Redis configured, delivery happens via the pub/sub listener on every
    replica (including this one); otherwise straight to local queues.
    """
    data = event.model_dump_json()
    if settings.REDIS_URL:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            _deliver_local(doc_id, data)
            return
        loop.create_task(_publish_redis(doc_id, data))
        return
    _deliver_local(doc_id, data)


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
