"""Who is acting in the current request, and how to show them.

Every write already passes `api_key_id` along when an agent made it; what was
missing is the person. Rather than threading a `user_id` through every service
call that logs activity, the authenticated user is bound here once, in
`get_current_user`, and `log_activity` reads it. Each request runs in its own
task with its own copy of the context, so the value never leaks between
requests.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

_current_user_id: ContextVar[str | None] = ContextVar("docforge_actor_user_id", default=None)


def bind(user_id: str | None) -> None:
    _current_user_id.set(user_id)


def current_user_id() -> str | None:
    return _current_user_id.get()


def person_label(name: str | None, email: str | None) -> str:
    """A person's display name: their name, else the part of the email before the @."""
    if name and name.strip():
        return name.strip()
    if email and not email.endswith("@clerk.local"):
        return email.split("@", 1)[0]
    return "Someone"


async def names_for(
    db: AsyncSession,
    user_ids: set[str],
    api_key_ids: set[uuid.UUID],
) -> tuple[dict[str, str], dict[uuid.UUID, tuple[str, str | None]]]:
    """Display names for people and agents, in two queries.

    Returns `(people, agents)`: user id → name, and api key id → (key name, harness).
    """
    from app.models.api_key import ApiKey
    from app.models.user import User

    people: dict[str, str] = {}
    agents: dict[uuid.UUID, tuple[str, str | None]] = {}
    ids = {u for u in user_ids if u}
    if ids:
        rows = await db.execute(select(User.id, User.name, User.email).where(User.id.in_(ids)))
        people = {uid: person_label(name, email) for uid, name, email in rows}
    keys = {k for k in api_key_ids if k}
    if keys:
        rows = await db.execute(select(ApiKey.id, ApiKey.name, ApiKey.harness).where(ApiKey.id.in_(keys)))
        agents = {kid: (name, harness) for kid, name, harness in rows}
    return people, agents
