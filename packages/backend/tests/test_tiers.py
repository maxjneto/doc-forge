"""Tests for the tiers single source of truth and Free plan limit enforcement."""

from unittest.mock import AsyncMock, patch

import pytest

from app.config import settings
from app.models.user import User


@pytest.mark.asyncio
async def test_tiers_endpoint_is_public_and_complete(client_factory):
    async with client_factory() as client:
        res = await client.get("/api/tiers")
        assert res.status_code == 200
        tiers = res.json()["tiers"]
        slugs = [t["slug"] for t in tiers]
        assert slugs == ["free", "pro", "team"]
        free = tiers[0]
        assert free["limits"]["max_active_documents"] == settings.FREE_MAX_ACTIVE_DOCUMENTS
        assert free["limits"]["max_api_keys"] == settings.FREE_MAX_API_KEYS
        assert free["limits"]["weekly_credits"] == settings.WEEKLY_CREDITS


@pytest.mark.asyncio
async def test_free_plan_document_limit_enforced(client_factory):
    user = User(
        id="u_tier1", email="t1@test.com", name="T",
        credits=settings.FREE_MAX_ACTIVE_DOCUMENTS + 5,
    )
    async with client_factory(user) as client:
        for i in range(settings.FREE_MAX_ACTIVE_DOCUMENTS):
            res = await client.post("/api/documents", json={"title": f"Doc {i}", "mode": "editor"})
            assert res.status_code == 201, res.text

        res = await client.post("/api/documents", json={"title": "Over limit", "mode": "editor"})
        assert res.status_code == 403
        assert "limit" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_free_plan_api_key_limit_enforced(client_factory):
    user = User(id="u_tier2", email="t2@test.com", name="T", credits=5)
    async with client_factory(user) as client:
        for i in range(settings.FREE_MAX_API_KEYS):
            res = await client.post("/api/users/api-keys", json={"name": f"Agent {i}"})
            assert res.status_code == 201, res.text

        res = await client.post("/api/users/api-keys", json={"name": "One too many"})
        assert res.status_code == 403
        assert "agent" in res.json()["detail"].lower()

        # Revoking frees the slot
        keys = (await client.get("/api/users/api-keys")).json()
        active = next(k for k in keys if not k.get("revoked_at"))
        res = await client.delete(f"/api/users/api-keys/{active['id']}")
        assert res.status_code == 204
        res = await client.post("/api/users/api-keys", json={"name": "Replacement"})
        assert res.status_code == 201


@pytest.mark.asyncio
async def test_pro_plan_bypasses_limits(client_factory):
    user = User(
        id="u_tier3", email="t3@test.com", name="T",
        credits=settings.FREE_MAX_ACTIVE_DOCUMENTS + 5, plan="pro",
    )
    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            for i in range(settings.FREE_MAX_ACTIVE_DOCUMENTS + 1):
                res = await client.post(
                    "/api/documents", json={"title": f"Doc {i}", "mode": "editor"}
                )
                assert res.status_code == 201, res.text


@pytest.mark.asyncio
async def test_me_exposes_plan(client_factory):
    async with client_factory() as client:
        res = await client.get("/api/users/me")
        assert res.json()["plan"] == "free"
