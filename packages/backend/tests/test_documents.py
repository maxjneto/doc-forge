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
