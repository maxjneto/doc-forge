"""Tests for POST /api/documents/:id/rerun-audit."""

import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.database import get_db
from app.models.document import Document
from app.models.user import User
from .conftest import TestSession, _override_get_db


async def _seed_document(
    user: User,
    current_phase: str = "refinement",
    document_type_id: uuid.UUID | None = None,
) -> Document:
    """Seed a user and a document into the test DB, bypassing the creation API."""
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == user.id))
        if not result.scalar_one_or_none():
            session.add(User(id=user.id, email=user.email, name=user.name, credits=user.credits))
        doc = Document(
            id=uuid.uuid4(),
            user_id=user.id,
            document_type_id=document_type_id,
            title="Test RFC",
            current_phase=current_phase,
            document_context="This is a test document context for rerun audit.",
        )
        session.add(doc)
        await session.commit()
        await session.refresh(doc)
        return doc


@pytest.mark.asyncio
async def test_rerun_audit_success(client_factory):
    """Dispatches docforge/document.refinement_completed when document is in refinement."""
    user = User(id="user_ra_ok", email="ra_ok@test.com", name="RA OK", credits=1)
    doc = await _seed_document(user)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(f"/api/documents/{doc.id}/rerun-audit")

    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
    mock_inngest.send.assert_called_once()
    event = mock_inngest.send.call_args[0][0]
    assert event.name == "docforge/document.refinement_completed"
    assert event.data["document_id"] == str(doc.id)


@pytest.mark.asyncio
async def test_rerun_audit_event_includes_document_type_id(client_factory):
    """Event payload carries document_type_id when the document has one."""
    user = User(id="user_ra_dt", email="ra_dt@test.com", name="RA DT", credits=1)
    doc_type_id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
    doc = await _seed_document(user, document_type_id=doc_type_id)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(f"/api/documents/{doc.id}/rerun-audit")

    assert res.status_code == 200
    event = mock_inngest.send.call_args[0][0]
    assert event.data["document_type_id"] == str(doc_type_id)


@pytest.mark.asyncio
async def test_rerun_audit_event_document_type_id_is_none_when_absent(client_factory):
    """Event payload has document_type_id=None when the document has no type set."""
    user = User(id="user_ra_nodt", email="ra_nodt@test.com", name="RA NoDT", credits=1)
    doc = await _seed_document(user, document_type_id=None)

    async with client_factory(user) as client:
        with patch("app.routers.documents.inngest_client") as mock_inngest:
            mock_inngest.send = AsyncMock()
            res = await client.post(f"/api/documents/{doc.id}/rerun-audit")

    assert res.status_code == 200
    event = mock_inngest.send.call_args[0][0]
    assert event.data["document_type_id"] is None


@pytest.mark.asyncio
async def test_rerun_audit_wrong_owner_returns_404(client_factory):
    """Returns 404 when the document belongs to a different user (ownership isolation)."""
    owner = User(id="user_ra_owner", email="ra_owner@test.com", name="Owner", credits=1)
    other = User(id="user_ra_other", email="ra_other@test.com", name="Other", credits=1)
    doc = await _seed_document(owner)

    async with client_factory(other) as client:
        res = await client.post(f"/api/documents/{doc.id}/rerun-audit")

    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_rerun_audit_unknown_document_id_returns_404(client_factory):
    """Returns 404 for a document_id that does not exist in the database."""
    user = User(id="user_ra_miss", email="ra_miss@test.com", name="Missing", credits=1)
    nonexistent_id = uuid.uuid4()

    async with client_factory(user) as client:
        res = await client.post(f"/api/documents/{nonexistent_id}/rerun-audit")

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_rerun_audit_wrong_phase_returns_409(client_factory):
    """Returns 409 when the document is not currently in the refinement phase."""
    user = User(id="user_ra_phase", email="ra_phase@test.com", name="Phase", credits=1)
    doc = await _seed_document(user, current_phase="audit")

    async with client_factory(user) as client:
        res = await client.post(f"/api/documents/{doc.id}/rerun-audit")

    assert res.status_code == 409
    assert "refinement" in res.json()["detail"].lower()


@pytest.mark.parametrize("phase", ["discovery", "alignment", "generation", "audit", "completed"])
@pytest.mark.asyncio
async def test_rerun_audit_any_non_refinement_phase_returns_409(client_factory, phase):
    """Returns 409 for every phase other than refinement."""
    user = User(id=f"user_ra_{phase}", email=f"ra_{phase}@test.com", name=phase, credits=1)
    doc = await _seed_document(user, current_phase=phase)

    async with client_factory(user) as client:
        res = await client.post(f"/api/documents/{doc.id}/rerun-audit")

    assert res.status_code == 409


@pytest.mark.asyncio
async def test_rerun_audit_requires_auth():
    """Returns 401 when no Bearer token is provided."""
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(f"/api/documents/{uuid.uuid4()}/rerun-audit")
    assert res.status_code == 401
    app.dependency_overrides.clear()
