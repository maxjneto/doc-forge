import uuid
"""Tests for document creation and credit system."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.user import User

from .conftest import TestSession


@pytest.mark.asyncio
async def test_create_document_success(client_factory):
    """Document creation succeeds with credits available."""
    user = User(id="user_credits", email="c@test.com", name="C", credits=3)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={"title": "My RFC", "document_context": "Build a REST API for user authentication"},
            )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "My RFC"
    assert data["current_phase"] == "discovery"


@pytest.mark.asyncio
async def test_create_document_no_credits_rejected(client_factory):
    """Document creation fails when user has no credits."""
    user = User(id="user_broke", email="broke@test.com", name="Broke", credits=0)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={"title": "Denied", "document_context": "No credits available for this document creation"},
            )
    assert res.status_code == 402
    assert "credits" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_credit_deduction_is_atomic(client_factory):
    """After creating a guided document, credits decrease by exactly GUIDED_DOCUMENT_COST."""
    from app.config import settings

    starting = settings.GUIDED_DOCUMENT_COST + 2
    user = User(id="user_atomic", email="atom@test.com", name="Atom", credits=starting)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={"title": "First", "document_context": "Test context for the credit deduction scenario"},
            )
            assert res.status_code == 201

    # Verify credit was deducted in the DB
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "user_atomic"))
        db_user = result.scalar_one()
        assert db_user.credits == starting - settings.GUIDED_DOCUMENT_COST


@pytest.mark.asyncio
async def test_editor_document_is_available_without_credits(client_factory):
    """The editor has no hosted AI cost and must remain usable at zero credits."""
    user = User(id="user_editor_free", email="editor-free@test.com", credits=0)

    async with client_factory(user) as client:
        res = await client.post(
            "/api/documents",
            json={"title": "Free editor", "mode": "editor"},
        )

    assert res.status_code == 201, res.text

    async with TestSession() as session:
        db_user = (await session.execute(
            select(User).where(User.id == "user_editor_free")
        )).scalar_one()
        assert db_user.credits == 0


@pytest.mark.asyncio
async def test_create_document_dispatches_inngest_event(client_factory):
    """Document creation dispatches the docforge/document.started event."""
    user = User(id="user_evt", email="evt@test.com", name="Evt", credits=5)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={"title": "Event test", "document_context": "Test context for the Inngest event dispatch check"},
            )
            assert res.status_code == 201
            mock_inngest.send.assert_called_once()
            event = mock_inngest.send.call_args[0][0]
            assert event.name == "docforge/document.started"


@pytest.mark.asyncio
async def test_publish_marks_the_active_version_and_gate_can_block_it(client_factory):
    """Publishing is a deliberate sign-off, and the gate is a gate.

    The active version is the working draft; `is_published` marks the one
    people are meant to read. A blocking finding stops the sign-off.
    """
    from sqlalchemy import select

    from app.models import AuditFinding, SectionVersion

    from .conftest import TestSession

    user = User(id="u_pub1", email="p1@test.com", name="P", credits=5)
    async with client_factory(user) as client:
        res = await client.post("/api/documents", json={"title": "Doc", "mode": "editor"})
        doc_id = res.json()["id"]
        detail = await client.get(f"/api/documents/{doc_id}")
        section_id = next(
            s["id"] for s in detail.json()["sections"] if s["section_type"] == "body"
        )
        await client.patch(f"/api/sections/{section_id}/content", json={"content": "v1\n"})

        published = await client.post(f"/api/documents/{doc_id}/publish")
        assert published.status_code == 200, published.text
        published_id = published.json()["published_version_id"]

        detail = await client.get(f"/api/documents/{doc_id}")
        assert detail.json()["document"]["published_version_id"] == published_id
        assert detail.json()["document"]["has_unpublished_changes"] is False

        async with TestSession() as session:
            rows = await session.execute(
                select(SectionVersion).where(SectionVersion.section_id == uuid.UUID(section_id))
            )
            versions = rows.scalars().all()
            assert sum(1 for v in versions if v.is_published) == 1

        await client.patch(f"/api/sections/{section_id}/content", json={"content": "v2\n"})
        detail = await client.get(f"/api/documents/{doc_id}")
        assert detail.json()["document"]["published_version_id"] == published_id
        assert detail.json()["document"]["has_unpublished_changes"] is True

        # A blocking finding stops the next sign-off.
        async with TestSession() as session:
            session.add(
                AuditFinding(
                    document_id=uuid.UUID(doc_id),
                    section_type="body",
                    severity="high",
                    description="contradiz a seção 2",
                )
            )
            await session.commit()

        blocked = await client.post(f"/api/documents/{doc_id}/publish")
        assert blocked.status_code == 409
        assert "bloqueante" in blocked.json()["detail"]
