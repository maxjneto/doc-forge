"""Built-in guided-workflow document types (RFC + ADR/Postmortem/Runbook).

Mirrors migration 024. conftest seeds the four built-in types; these tests
assert they are listed and that creating a document of a new type materializes
the section skeleton defined for it.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.section import Section
from app.models.user import User

from .conftest import TestSession

EXPECTED_SECTIONS = {
    "rfc": ["context", "proposal", "implementation", "risks"],
    "adr": ["context", "decision", "consequences", "alternatives"],
    "postmortem": ["summary", "impact", "timeline", "root_cause", "action_items"],
    "runbook": ["overview", "prerequisites", "procedure", "verification", "rollback"],
}


@pytest.mark.asyncio
async def test_builtin_types_listed(client_factory):
    async with client_factory() as client:
        res = await client.get("/api/document-types")
    assert res.status_code == 200
    slugs = {t["slug"] for t in res.json()}
    assert {"rfc", "adr", "postmortem", "runbook"} <= slugs


@pytest.mark.asyncio
@pytest.mark.parametrize("slug", ["adr", "postmortem", "runbook"])
async def test_new_type_creates_its_sections(client_factory, slug):
    user = User(id=f"u_{slug}", email=f"{slug}@test.com", name="T", credits=5)
    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(
                "/api/documents",
                json={
                    "document_type_slug": slug,
                    "document_context": (
                        "The payments service returned elevated 500 error rates for "
                        "about forty minutes after a database migration; we need to "
                        "capture what happened and how to handle it next time."
                    ),
                },
            )
    assert res.status_code == 201, res.text
    doc_id = res.json()["id"]

    async with TestSession() as session:
        rows = await session.execute(
            select(Section.section_type).where(Section.document_id == uuid.UUID(doc_id))
        )
        created = set(rows.scalars().all())
    assert created == set(EXPECTED_SECTIONS[slug])
