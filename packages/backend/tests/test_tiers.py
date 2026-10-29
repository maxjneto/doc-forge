"""Tests for the tiers single source of truth and Free plan limit enforcement."""


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
        assert free["limits"]["weekly_document_creations"] == settings.FREE_WEEKLY_DOCUMENT_CREDITS


@pytest.mark.asyncio
async def test_free_plan_document_limit_enforced(client_factory):
    user = User(
        id="u_tier1", email="t1@test.com", name="T",
        credits=settings.FREE_MAX_ACTIVE_DOCUMENTS + 5,
    )
    async with client_factory(user) as client:
        for i in range(settings.FREE_MAX_ACTIVE_DOCUMENTS):
            res = await client.post("/api/documents", json={"title": f"Doc {i}"})
            assert res.status_code == 201, res.text

        res = await client.post("/api/documents", json={"title": "Over limit"})
        assert res.status_code == 403
        assert "limit" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_archiving_frees_an_active_document_slot(client_factory):
    user = User(
        id="u_tier_archive", email="archive@test.com", name="Archive",
        credits=settings.FREE_MAX_ACTIVE_DOCUMENTS + 1,
    )
    async with client_factory(user) as client:
        ids = []
        for i in range(settings.FREE_MAX_ACTIVE_DOCUMENTS):
            res = await client.post("/api/documents", json={"title": f"Doc {i}"})
            assert res.status_code == 201, res.text
            ids.append(res.json()["id"])
        assert (await client.post(f"/api/documents/{ids[0]}/archive")).status_code == 200
        res = await client.post("/api/documents", json={"title": "Replacement"})
        assert res.status_code == 201, res.text
        archived = await client.get("/api/documents?include_archived=true")
        assert any(doc["id"] == ids[0] and doc["archived_at"] for doc in archived.json()["documents"])


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
        for i in range(settings.FREE_MAX_ACTIVE_DOCUMENTS + 1):
            res = await client.post(
                "/api/documents", json={"title": f"Doc {i}"}
            )
            assert res.status_code == 201, res.text


@pytest.mark.asyncio
async def test_me_exposes_plan(client_factory):
    async with client_factory() as client:
        res = await client.get("/api/users/me")
        payload = res.json()
        assert payload["plan"] == "free"
        assert payload["next_document_creations_reset_at"]
        assert payload["weekly_document_creations"] == settings.FREE_WEEKLY_DOCUMENT_CREDITS
