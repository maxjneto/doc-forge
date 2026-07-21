"""Tests for Free-plan version retention (product-plan §9.4).

create_section_version prunes the oldest inactive versions of a section once
the Free-plan limit is exceeded — never the active version, never a version
still referenced by a Suggestion.
"""

import pytest

from app.config import settings
from app.models.user import User

pytestmark = pytest.mark.asyncio


async def _create_editor_document(client) -> tuple[str, str]:
    res = await client.post("/api/documents", json={"title": "Doc", "mode": "editor"})
    assert res.status_code == 201, res.text
    doc_id = res.json()["id"]
    detail = await client.get(f"/api/documents/{doc_id}")
    body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
    return doc_id, body["id"]


async def test_free_plan_prunes_old_inactive_versions(client_factory, monkeypatch):
    monkeypatch.setattr(settings, "FREE_MAX_VERSIONS_PER_SECTION", 3)
    user = User(id="u_retain1", email="r1@test.com", name="R", credits=20, plan="free")

    async with client_factory(user) as client:
        _, section_id = await _create_editor_document(client)

        # Create 6 snapshots beyond the initial draft — well past the limit of 3
        for i in range(6):
            res = await client.post(
                f"/api/sections/{section_id}/versions/snapshot",
                json={"version_name": f"v{i}"},
            )
            assert res.status_code == 201

        versions = await client.get(f"/api/sections/{section_id}/versions")
        names = [v["version_name"] for v in versions.json()]
        # Exactly the limit survives: active + (limit - 1) inactive
        assert len(names) == 3
        # The most recent ones survive; oldest pruned
        assert "v5" in names  # latest snapshot (now active)
        assert "v0" not in names  # oldest pruned


async def test_pro_plan_keeps_unlimited_versions(client_factory, monkeypatch):
    monkeypatch.setattr(settings, "FREE_MAX_VERSIONS_PER_SECTION", 3)
    user = User(id="u_retain2", email="r2@test.com", name="R", credits=20, plan="pro")

    async with client_factory(user) as client:
        _, section_id = await _create_editor_document(client)
        for i in range(6):
            res = await client.post(
                f"/api/sections/{section_id}/versions/snapshot",
                json={"version_name": f"v{i}"},
            )
            assert res.status_code == 201

        versions = await client.get(f"/api/sections/{section_id}/versions")
        # Initial draft + 6 snapshots = 7, nothing pruned on Pro
        assert len(versions.json()) == 7


async def test_pending_suggestion_version_survives_pruning(client_factory, monkeypatch):
    """A suggestion's proposed version must never be silently pruned away."""
    monkeypatch.setattr(settings, "FREE_MAX_VERSIONS_PER_SECTION", 2)
    user = User(id="u_retain3", email="r3@test.com", name="R", credits=20, plan="free")

    async with client_factory(user) as client:
        doc_id, section_id = await _create_editor_document(client)

        # Create a pending suggestion early — its version must survive later pruning
        res = await client.post(
            f"/api/sections/{section_id}/suggestions",
            json={"content": "proposed content to protect"},
        )
        assert res.status_code == 201
        suggestion_id = res.json()["id"]

        # Push well past the retention limit via direct writes/snapshots
        for i in range(5):
            res = await client.post(
                f"/api/sections/{section_id}/versions/snapshot",
                json={"version_name": f"v{i}"},
            )
            assert res.status_code == 201

        # The suggestion is still resolvable — its version wasn't deleted
        res = await client.get(f"/api/suggestions/{suggestion_id}")
        assert res.status_code == 200
        assert res.json()["proposed_content"] == "proposed content to protect"

        res = await client.post(f"/api/suggestions/{suggestion_id}/accept")
        assert res.status_code == 200
