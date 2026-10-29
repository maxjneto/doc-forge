"""Several people and agents on one document.

What these pin down: a shared Markdown document works for the people it was
shared with (each within their role), every entry says who acted, comments are
conversations an agent can answer, and presence follows the open connection.
"""

import uuid

import pytest
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.models.api_key import ApiKey
from app.models.user import User
from app.services import actor, presence

from .conftest import TestSession, _override_get_db, _seed_user

OWNER = User(id="u_owner", email="owner@test.com", name="Olivia", credits=5)
EDITOR = User(id="u_editor", email="editor@test.com", name="Edu", credits=5)
VIEWER = User(id="u_viewer", email="viewer@test.com", name="", credits=5)
COMMENTER = User(id="u_commenter", email="commenter@test.com", name="Cora", credits=5)
KEY_ID = uuid.UUID("00000000-0000-0000-0000-0000000c0ab0")


def agent_client(user: User) -> AsyncClient:
    """A client authenticated with an API key owned by `user`."""

    async def _override(request: Request):
        await _seed_user(user)
        async with TestSession() as session:
            if (await session.execute(select(ApiKey).where(ApiKey.id == KEY_ID))).scalar_one_or_none() is None:
                session.add(ApiKey(id=KEY_ID, user_id=user.id, key_hash="collab", name="Claude Code", harness="claude-code"))
                await session.commit()
        request.state.api_key_id = KEY_ID
        actor.bind(user.id)
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _shared_document(client_factory) -> tuple[str, str]:
    """A Markdown document owned by OWNER, shared with an editor, a viewer and a commenter."""
    # Sharing with an existing account binds the member at once.
    for u in (EDITOR, VIEWER, COMMENTER):
        await _seed_user(u)
    async with client_factory(OWNER) as client:
        doc_id = (await client.post("/api/documents", json={"title": "Plano"})).json()["id"]
        for u, role in ((EDITOR, "editor"), (VIEWER, "viewer"), (COMMENTER, "commenter")):
            res = await client.post(f"/api/documents/{doc_id}/members", json={"email": u.email, "role": role})
            assert res.status_code == 201, res.text
        detail = await client.get(f"/api/documents/{doc_id}")
        body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
    return doc_id, body["id"]


@pytest.mark.asyncio
async def test_a_shared_markdown_document_works_within_each_role(client_factory):
    doc_id, body_id = await _shared_document(client_factory)

    async with client_factory(EDITOR) as client:
        saved = await client.patch(f"/api/sections/{body_id}/content", json={"content": "# Plano\n\nTexto do editor."})
        assert saved.status_code == 200, saved.text
        assert (await client.get(f"/api/documents/{doc_id}/suggestions")).status_code == 200
        assert (await client.get(f"/api/sections/{body_id}/versions")).status_code == 200
        assert (await client.get(f"/api/documents/{doc_id}/artifacts")).status_code == 200

    async with client_factory(VIEWER) as client:
        assert (await client.get(f"/api/documents/{doc_id}/activity")).status_code == 200
        assert (await client.get(f"/api/documents/{doc_id}/feedback")).status_code == 200
        refused = await client.patch(f"/api/sections/{body_id}/content", json={"content": "não"})
        assert refused.status_code == 403
        assert (await client.post(f"/api/documents/{doc_id}/feedback", json={"content": "oi"})).status_code == 403

    async with client_factory(COMMENTER) as client:
        assert (await client.post(f"/api/documents/{doc_id}/feedback", json={"content": "oi"})).status_code == 201
        assert (await client.post(f"/api/documents/{doc_id}/publish")).status_code == 403

    # Only the owner decides how agents may write.
    async with client_factory(EDITOR) as client:
        assert (await client.patch(f"/api/documents/{doc_id}", json={"title": "Plano v2"})).status_code == 200
        assert (await client.patch(f"/api/documents/{doc_id}", json={"agent_write_policy": "direct"})).status_code == 403


@pytest.mark.asyncio
async def test_activity_names_each_person_and_agent(client_factory):
    doc_id, body_id = await _shared_document(client_factory)

    async with client_factory(EDITOR) as client:
        await client.patch(f"/api/sections/{body_id}/content", json={"content": "# Plano\n\nDo editor."})
    async with agent_client(OWNER) as client:
        res = await client.patch(f"/api/sections/{body_id}/content", json={"content": "# Plano\n\nDo agente."})
        assert res.status_code == 200, res.text

    async with client_factory(OWNER) as client:
        entries = (await client.get(f"/api/documents/{doc_id}/activity")).json()

    by_action = {(e["action_type"], e["actor_name"]): e for e in entries}
    edit = by_action[("write", "Edu")]
    assert edit["is_agent"] is False and edit["is_me"] is False
    proposal = by_action[("suggestion_created", "Claude Code")]
    assert proposal["is_agent"] is True
    assert proposal["on_behalf_of"] == "Olivia"
    assert proposal["harness"] == "claude-code"
    created = by_action[("document_created", "Olivia")]
    assert created["is_me"] is True


@pytest.mark.asyncio
async def test_comments_are_threads_an_agent_can_answer(client_factory):
    doc_id, _ = await _shared_document(client_factory)

    async with client_factory(COMMENTER) as client:
        root = (await client.post(
            f"/api/documents/{doc_id}/feedback",
            json={"content": "Isto está certo?", "anchor": {"quote": "Texto", "heading": "Plano"}, "for_agent": True},
        )).json()
    assert root["for_agent"] is True
    assert root["anchor"] == {"quote": "Texto", "heading": "Plano"}
    assert root["author_name"] == "Cora" and root["is_mine"] is True

    async with agent_client(OWNER) as client:
        reply = await client.post(f"/api/feedback/{root['id']}/replies", json={"content": "Sim, conferi."})
        assert reply.status_code == 201, reply.text
        # Resolving through a reply closes the thread it belongs to.
        resolved = await client.post(f"/api/feedback/{reply.json()['id']}/resolve", json={"resolution_note": "ok"})
        assert resolved.json()["id"] == root["id"]
        assert resolved.json()["status"] == "resolved"

    async with client_factory(OWNER) as client:
        everything = (await client.get(f"/api/documents/{doc_id}/feedback")).json()["feedback"]
        assert [f["content"] for f in everything] == ["Isto está certo?", "Sim, conferi."]
        answer = everything[1]
        assert answer["parent_id"] == root["id"]
        assert answer["by_agent"] is True and answer["author_name"] == "Claude Code"
        assert (await client.get(f"/api/documents/{doc_id}/feedback?status=open")).json()["feedback"] == []

        reopened = await client.patch(f"/api/feedback/{root['id']}", json={"status": "open", "for_agent": False})
        assert reopened.json()["status"] == "open" and reopened.json()["for_agent"] is False
        still_open = (await client.get(f"/api/documents/{doc_id}/feedback?status=open")).json()["feedback"]
        assert len(still_open) == 2  # the thread and its reply


@pytest.mark.asyncio
async def test_presence_follows_connections_and_recent_agent_writes(client_factory):
    doc_id, body_id = await _shared_document(client_factory)

    first = presence.join(doc_id, OWNER.id, "Olivia")
    second_tab = presence.join(doc_id, OWNER.id, "Olivia")
    presence.join(doc_id, EDITOR.id, "Edu")
    async with agent_client(OWNER) as client:
        await client.patch(f"/api/sections/{body_id}/content", json={"content": "# Agente"})

    async with client_factory(EDITOR) as client:
        here = (await client.get(f"/api/documents/{doc_id}/presence")).json()
    assert [(p["name"], p["is_me"]) for p in here["people"]] == [("Olivia", False), ("Edu", True)]
    assert [(a["name"], a["on_behalf_of"]) for a in here["agents"]] == [("Claude Code", "Olivia")]

    # Closing one of two tabs keeps the person here; closing both does not.
    presence.leave(doc_id, first)
    async with client_factory(EDITOR) as client:
        assert len((await client.get(f"/api/documents/{doc_id}/presence")).json()["people"]) == 2
    presence.leave(doc_id, second_tab)
    async with client_factory(EDITOR) as client:
        assert [p["name"] for p in (await client.get(f"/api/documents/{doc_id}/presence")).json()["people"]] == ["Edu"]
