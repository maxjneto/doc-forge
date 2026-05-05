"""Tests for authentication and authorization."""

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.database import get_db
from app.models.user import User

from .conftest import _override_get_db


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected():
    """Requests without Bearer token get 401."""
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/documents")
    assert res.status_code == 401
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_endpoint_no_auth():
    """Health endpoint is publicly accessible."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_user_cannot_access_other_users_documents(client_factory):
    """Verify ownership isolation — user A cannot see user B's documents."""
    user_a = User(id="user_a", email="a@test.com", name="A", credits=5)
    user_b = User(id="user_b", email="b@test.com", name="B", credits=5)

    # Create document as user A
    async with client_factory(user_a) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={"title": "A's doc", "document_context": "Test context"},
            )
            assert res.status_code == 201
            doc_id = res.json()["id"]

    # Try to access as user B
    async with client_factory(user_b) as client:
        res = await client.get(f"/api/documents/{doc_id}")
        assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_documents_only_returns_own(client_factory):
    """List endpoint only returns documents owned by the authenticated user."""
    user_a = User(id="user_a", email="a@test.com", name="A", credits=5)
    user_b = User(id="user_b", email="b@test.com", name="B", credits=5)

    # Create doc as user A
    async with client_factory(user_a) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={"title": "A's doc", "document_context": "ctx"},
            )
            assert res.status_code == 201

    # List as user B — should be empty
    async with client_factory(user_b) as client:
        res = await client.get("/api/documents")
        assert res.status_code == 200
        assert res.json()["documents"] == []
