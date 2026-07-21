"""Tests for the suggestion write path (P1) and the feedback loop (P2).

The most critical path in the system from M1 onward: agent writes become
pending suggestions, humans accept/reject, rejections with comments become
agent-readable feedback.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.models.api_key import ApiKey
from app.models.section import SectionVersion
from app.models.user import User

from .conftest import TestSession, _override_get_db, _seed_user

AGENT_KEY_ID = uuid.UUID("00000000-0000-0000-0000-00000000a9e1")


async def _seed_api_key(user: User) -> None:
    async with TestSession() as session:
        result = await session.execute(select(ApiKey).where(ApiKey.id == AGENT_KEY_ID))
        if result.scalar_one_or_none() is None:
            session.add(ApiKey(
                id=AGENT_KEY_ID,
                user_id=user.id,
                key_hash="test-hash",
                name="Claude Code",
                harness="claude-code",
            ))
            await session.commit()


@pytest.fixture
def agent_client_factory():
    """Client that authenticates as an agent: api_key_id lands on request.state."""

    def _create(user: User | None = None):
        u = user or User(id="user_test123", email="test@example.com", name="Test User", credits=5)

        async def _override_user(request):
            await _seed_user(u)
            await _seed_api_key(u)
            request.state.api_key_id = AGENT_KEY_ID
            return u

        from fastapi import Request

        async def _override(request: Request):
            return await _override_user(request)

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user] = _override
        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://test")

    return _create


async def _create_editor_document(client) -> tuple[str, str]:
    """Create an editor document; returns (document_id, body_section_id)."""
    res = await client.post("/api/documents", json={"title": "Doc", "mode": "editor"})
    assert res.status_code == 201, res.text
    doc_id = res.json()["id"]
    detail = await client.get(f"/api/documents/{doc_id}")
    body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
    return doc_id, body["id"]


@pytest.mark.asyncio
async def test_agent_write_becomes_suggestion_by_default(client_factory, agent_client_factory):
    user = User(id="u_sugg1", email="s1@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        # Human writes directly first (baseline content)
        res = await human.patch(f"/api/sections/{section_id}/content", json={"content": "original"})
        assert res.status_code == 200
        assert res.json()["content"] == "original"

    async with agent_client_factory(user) as agent:
        res = await agent.patch(
            f"/api/sections/{section_id}/content",
            json={"content": "agent rewrite", "note": "Improved intro"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == "suggestion"
        suggestion_id = data["suggestion_id"]

    async with client_factory(user) as human:
        # Active content unchanged — the write was held for review
        detail = await human.get(f"/api/documents/{doc_id}")
        body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
        assert body["active_version_content"] == "original"

        # Suggestion is listed pending with diff-ready content and attribution
        listed = await human.get(f"/api/documents/{doc_id}/suggestions", params={"status": "pending"})
        suggestions = listed.json()["suggestions"]
        assert len(suggestions) == 1
        s = suggestions[0]
        assert s["id"] == suggestion_id
        assert s["proposed_content"] == "agent rewrite"
        assert s["current_content"] == "original"
        assert s["agent_name"] == "Claude Code"
        assert s["note"] == "Improved intro"
        assert s["is_stale"] is False


@pytest.mark.asyncio
async def test_accept_suggestion_activates_proposed_version(client_factory, agent_client_factory):
    user = User(id="u_sugg2", email="s2@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        await human.patch(f"/api/sections/{section_id}/content", json={"content": "v1"})

    async with agent_client_factory(user) as agent:
        res = await agent.patch(f"/api/sections/{section_id}/content", json={"content": "v2 proposed"})
        suggestion_id = res.json()["suggestion_id"]

    async with client_factory(user) as human:
        res = await human.post(f"/api/suggestions/{suggestion_id}/accept")
        assert res.status_code == 200
        assert res.json()["status"] == "accepted"

        detail = await human.get(f"/api/documents/{doc_id}")
        body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
        assert body["active_version_content"] == "v2 proposed"

        # Accepting twice is a conflict
        res = await human.post(f"/api/suggestions/{suggestion_id}/accept")
        assert res.status_code == 409

    # Exactly one active version remains
    async with TestSession() as session:
        result = await session.execute(
            select(SectionVersion).where(
                SectionVersion.section_id == uuid.UUID(section_id),
                SectionVersion.is_active.is_(True),
            )
        )
        assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_reject_with_comment_creates_feedback_loop(client_factory, agent_client_factory):
    user = User(id="u_sugg3", email="s3@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        await human.patch(f"/api/sections/{section_id}/content", json={"content": "timeout is 30s"})

    async with agent_client_factory(user) as agent:
        res = await agent.patch(f"/api/sections/{section_id}/content", json={"content": "timeout is 60s"})
        suggestion_id = res.json()["suggestion_id"]

    async with client_factory(user) as human:
        res = await human.post(
            f"/api/suggestions/{suggestion_id}/reject",
            json={"comment": "Wrong: the timeout is 30s, see config.py"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "rejected"

        # Content untouched
        detail = await human.get(f"/api/documents/{doc_id}")
        body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
        assert body["active_version_content"] == "timeout is 30s"

    # Agent reads the pending feedback and resolves it — the loop closes
    async with agent_client_factory(user) as agent:
        res = await agent.get(f"/api/documents/{doc_id}/feedback", params={"status": "open"})
        feedback = res.json()["feedback"]
        assert len(feedback) == 1
        assert "timeout is 30s" in feedback[0]["content"]
        assert feedback[0]["suggestion_id"] == suggestion_id

        res = await agent.post(
            f"/api/feedback/{feedback[0]['id']}/resolve",
            json={"resolution_note": "Fixed to 30s", "status": "resolved"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "resolved"

        res = await agent.get(f"/api/documents/{doc_id}/feedback", params={"status": "open"})
        assert res.json()["feedback"] == []


@pytest.mark.asyncio
async def test_direct_policy_lets_agent_write_directly(client_factory, agent_client_factory):
    user = User(id="u_sugg4", email="s4@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        res = await human.patch(f"/api/documents/{doc_id}", json={"agent_write_policy": "direct"})
        assert res.status_code == 200
        assert res.json()["agent_write_policy"] == "direct"

    async with agent_client_factory(user) as agent:
        res = await agent.patch(f"/api/sections/{section_id}/content", json={"content": "direct write"})
        assert res.status_code == 200
        assert res.json().get("mode") is None  # plain version response
        assert res.json()["content"] == "direct write"


@pytest.mark.asyncio
async def test_suggestion_goes_stale_when_human_edits(client_factory, agent_client_factory):
    user = User(id="u_sugg5", email="s5@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        await human.patch(f"/api/sections/{section_id}/content", json={"content": "base"})
        # Snapshot creates a new active version later — first the agent suggests
    async with agent_client_factory(user) as agent:
        await agent.patch(f"/api/sections/{section_id}/content", json={"content": "proposal"})

    async with client_factory(user) as human:
        # Human keeps editing: snapshot creates a NEW active version
        res = await human.post(f"/api/sections/{section_id}/versions/snapshot", json={})
        assert res.status_code == 201

        listed = await human.get(f"/api/documents/{doc_id}/suggestions", params={"status": "pending"})
        s = listed.json()["suggestions"][0]
        assert s["is_stale"] is True
        # Still acceptable — stale is informational, not blocking
        res = await human.post(f"/api/suggestions/{s['id']}/accept")
        assert res.status_code == 200


@pytest.mark.asyncio
async def test_explicit_suggestion_endpoint(client_factory):
    """Humans (or agents on direct-policy docs) can explicitly propose changes."""
    user = User(id="u_sugg6", email="s6@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        res = await human.post(
            f"/api/sections/{section_id}/suggestions",
            json={"content": "explicit proposal", "note": "please review"},
        )
        assert res.status_code == 201
        assert res.json()["status"] == "pending"

        listed = await human.get(f"/api/documents/{doc_id}/suggestions")
        assert len(listed.json()["suggestions"]) == 1


@pytest.mark.asyncio
async def test_user_feedback_comment_anchored_to_section(client_factory, agent_client_factory):
    user = User(id="u_sugg7", email="s7@test.com", name="S", credits=5)
    async with client_factory(user) as human:
        doc_id, section_id = await _create_editor_document(human)
        res = await human.post(
            f"/api/documents/{doc_id}/feedback",
            json={"content": "This section needs numbers", "section_id": section_id},
        )
        assert res.status_code == 201
        assert res.json()["status"] == "open"
        assert res.json()["section_id"] == section_id

    async with agent_client_factory(user) as agent:
        res = await agent.get(f"/api/documents/{doc_id}/feedback", params={"status": "open"})
        assert len(res.json()["feedback"]) == 1
