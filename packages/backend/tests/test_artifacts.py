"""Tests for artifacts — the supporting material around a document's text.

The interesting property is that anchoring is *explicit*: the body carries a
`::artefato[key]` directive, so `anchored` is derived from the markdown rather
than stored. That is what makes an anchor survive export and never drift when
the surrounding prose is rewritten.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.models.api_key import ApiKey
from app.models.user import User
from app.routers.artifacts import anchored_keys, directive_for

from .conftest import TestSession, _override_get_db, _seed_user

AGENT_KEY_ID = uuid.UUID("00000000-0000-0000-0000-00000000a9e2")

DIAGRAM = "```mermaid\nflowchart TD\n  A --> B\n```"


async def _seed_api_key(user: User) -> None:
    async with TestSession() as session:
        result = await session.execute(select(ApiKey).where(ApiKey.id == AGENT_KEY_ID))
        if result.scalar_one_or_none() is None:
            session.add(
                ApiKey(
                    id=AGENT_KEY_ID,
                    user_id=user.id,
                    key_hash="test-hash-artifacts",
                    name="Copasim",
                    harness="claude-code",
                )
            )
            await session.commit()


@pytest.fixture
def agent_client_factory():
    def _create(user: User):
        from fastapi import Request

        async def _override(request: Request):
            await _seed_user(user)
            await _seed_api_key(user)
            request.state.api_key_id = AGENT_KEY_ID
            return user

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user] = _override
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    return _create


async def _create_editor_document(client) -> tuple[str, str]:
    res = await client.post("/api/documents", json={"title": "Doc", "mode": "editor"})
    assert res.status_code == 201, res.text
    doc_id = res.json()["id"]
    detail = await client.get(f"/api/documents/{doc_id}")
    body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
    return doc_id, body["id"]


def test_directive_round_trip():
    assert directive_for("ciclo-do-host") == "::artefato[ciclo-do-host]"
    body = "texto\n\n::artefato[ciclo-do-host]\n\nmais texto ::artefato[outro]"
    assert anchored_keys(body) == {"ciclo-do-host", "outro"}
    assert anchored_keys("") == set()


@pytest.mark.asyncio
async def test_artifact_is_unanchored_until_the_body_points_at_it(client_factory):
    user = User(id="u_art1", email="a1@test.com", name="A", credits=5)
    async with client_factory(user) as client:
        doc_id, section_id = await _create_editor_document(client)

        res = await client.post(
            f"/api/documents/{doc_id}/artifacts",
            json={
                "key": "ciclo-do-host",
                "kind": "diagram",
                "title": "Ciclo do host — fases 0-5",
                "content": DIAGRAM,
            },
        )
        assert res.status_code == 201, res.text
        # Created but nothing references it yet — the SEM ÂNCORA state.
        assert res.json()["anchored"] is False

        await client.patch(
            f"/api/sections/{section_id}/content",
            json={"content": "## As fases\n\n::artefato[ciclo-do-host]\n"},
        )

        listed = await client.get(f"/api/documents/{doc_id}/artifacts")
        assert listed.json()["artifacts"][0]["anchored"] is True


@pytest.mark.asyncio
async def test_anchor_survives_the_prose_around_it_being_rewritten(client_factory):
    user = User(id="u_art2", email="a2@test.com", name="A", credits=5)
    async with client_factory(user) as client:
        doc_id, section_id = await _create_editor_document(client)
        await client.post(
            f"/api/documents/{doc_id}/artifacts",
            json={"key": "fluxo", "kind": "diagram", "title": "Fluxo", "content": DIAGRAM},
        )
        await client.patch(
            f"/api/sections/{section_id}/content",
            json={"content": "## Antes\n\nparágrafo original\n\n::artefato[fluxo]\n"},
        )
        assert (await client.get(f"/api/documents/{doc_id}/artifacts")).json()["artifacts"][0][
            "anchored"
        ] is True

        # Everything around the directive changes; the anchor does not care.
        await client.patch(
            f"/api/sections/{section_id}/content",
            json={"content": "## Outro título\n\ntexto completamente diferente\n\n::artefato[fluxo]\n"},
        )
        assert (await client.get(f"/api/documents/{doc_id}/artifacts")).json()["artifacts"][0][
            "anchored"
        ] is True


@pytest.mark.asyncio
async def test_keys_are_unique_per_document(client_factory):
    user = User(id="u_art3", email="a3@test.com", name="A", credits=5)
    async with client_factory(user) as client:
        doc_id, _ = await _create_editor_document(client)
        payload = {"key": "dup", "kind": "table", "title": "T", "content": "| a |\n| - |"}
        assert (await client.post(f"/api/documents/{doc_id}/artifacts", json=payload)).status_code == 201
        assert (await client.post(f"/api/documents/{doc_id}/artifacts", json=payload)).status_code == 409


@pytest.mark.asyncio
async def test_agent_authored_artifact_is_attributed_to_the_key(client_factory, agent_client_factory):
    user = User(id="u_art4", email="a4@test.com", name="Max", credits=5)
    async with client_factory(user) as human:
        doc_id, _ = await _create_editor_document(human)

    async with agent_client_factory(user) as agent:
        res = await agent.post(
            f"/api/documents/{doc_id}/artifacts",
            json={"key": "adr-07", "kind": "decision", "title": "ADR-07", "content": "porque sim"},
        )
        assert res.status_code == 201, res.text
        assert res.json()["is_agent"] is True
        assert res.json()["author"] == "Copasim"


@pytest.mark.asyncio
async def test_update_bumps_revision_only_when_something_changed(client_factory):
    user = User(id="u_art5", email="a5@test.com", name="A", credits=5)
    async with client_factory(user) as client:
        doc_id, _ = await _create_editor_document(client)
        created = await client.post(
            f"/api/documents/{doc_id}/artifacts",
            json={"key": "k", "kind": "diagram", "title": "T", "content": DIAGRAM},
        )
        artifact_id = created.json()["id"]
        assert created.json()["revision"] == 1

        same = await client.patch(f"/api/artifacts/{artifact_id}", json={"title": "T"})
        assert same.json()["revision"] == 1

        changed = await client.patch(f"/api/artifacts/{artifact_id}", json={"title": "Outro"})
        assert changed.json()["revision"] == 2

        assert (await client.delete(f"/api/artifacts/{artifact_id}")).status_code == 204
        assert (await client.get(f"/api/documents/{doc_id}/artifacts")).json()["artifacts"] == []


@pytest.mark.asyncio
async def test_artifacts_are_scoped_to_the_owner(client_factory):
    owner = User(id="u_art6", email="a6@test.com", name="A", credits=5)
    other = User(id="u_art7", email="a7@test.com", name="B", credits=5)
    async with client_factory(owner) as client:
        doc_id, _ = await _create_editor_document(client)
    async with client_factory(other) as intruder:
        res = await intruder.get(f"/api/documents/{doc_id}/artifacts")
        assert res.status_code == 404
