"""Tests for GET /api/documents/sample."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_sample_document_returns_200():
    """GET /documents/sample is publicly accessible and returns HTTP 200."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/documents/sample")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_sample_document_no_auth_required():
    """GET /documents/sample does not require a Bearer token."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Deliberately omit any Authorization header
        res = await client.get("/api/documents/sample")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_sample_document_schema():
    """Response matches DocumentDetailResponse schema: document, sections, discovery_questions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/documents/sample")

    data = res.json()

    # Top-level keys
    assert "document" in data
    assert "sections" in data
    assert "discovery_questions" in data

    # DocumentResponse shape
    doc = data["document"]
    assert "id" in doc
    assert "title" in doc
    assert "current_phase" in doc
    assert "created_at" in doc
    assert "updated_at" in doc

    # Completed document
    assert doc["current_phase"] == "completed"

    # At least one section
    assert len(data["sections"]) > 0
    section = data["sections"][0]
    assert "id" in section
    assert "section_type" in section
    assert "status" in section
    assert "summary" in section
    assert "active_version_content" in section

    # All sections are finalized in a completed document
    for s in data["sections"]:
        assert s["status"] == "finalized"
        assert s["active_version_content"] is not None

    # DiscoveryQuestionResponse shape
    for q in data["discovery_questions"]:
        assert "id" in q
        assert "question" in q
        assert "skipped" in q
        assert "created_at" in q


@pytest.mark.asyncio
async def test_sample_document_has_rfc_sections():
    """Sample document contains all four RFC section types."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/documents/sample")

    section_types = {s["section_type"] for s in res.json()["sections"]}
    assert section_types == {"context", "proposal", "implementation", "risks"}


@pytest.mark.asyncio
async def test_sample_document_is_idempotent():
    """Two consecutive calls return identical data (fixture is static)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.get("/api/documents/sample")
        res2 = await client.get("/api/documents/sample")

    assert res1.json() == res2.json()
