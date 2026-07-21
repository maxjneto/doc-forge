"""Document export: Markdown (free) + PDF/DOCX (Pro).

Renders are pure-Python (xhtml2pdf / htmldocx); tests assert the endpoint wires
assembly + gating + content types correctly and emits valid file bytes.
"""

import pytest

from app.models.document import Document
from app.models.section import Section, SectionVersion
from app.models.user import User

from .conftest import TestSession

_CONTENT = {
    "context": "## ignored heading\n\nThe **payments** service failed.\n\n| A | B |\n|---|---|\n| 1 | 2 |",
    "proposal": "Adopt a queue.\n\n```mermaid\ngraph TD\n  A-->B\n```",
}


async def _seed_document(user_id: str, title: str = "My RFC") -> str:
    """Insert a guided doc with two sections, each with an active version."""
    async with TestSession() as session:
        if await session.get(User, user_id) is None:
            session.add(User(id=user_id, email=f"{user_id}@t.com", name="T", credits=5))
            await session.flush()
        doc = Document(
            user_id=user_id,
            title=title,
            current_phase="completed",
            document_context="ctx",
        )
        session.add(doc)
        await session.flush()
        for key, body in _CONTENT.items():
            section = Section(document_id=doc.id, section_type=key, status="completed")
            session.add(section)
            await session.flush()
            session.add(SectionVersion(
                section_id=section.id, version_name="v1", content=body, is_active=True,
            ))
        await session.commit()
        return str(doc.id)


@pytest.mark.asyncio
async def test_markdown_export_is_free(client_factory):
    doc_id = await _seed_document("u_exp_md")
    async with client_factory(User(id="u_exp_md", email="e@t.com", name="T", credits=5, plan="free")) as client:
        res = await client.get(f"/api/documents/{doc_id}/export?format=md")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/markdown")
    assert "my-rfc.md" in res.headers["content-disposition"]
    body = res.text
    # Title + section headings assembled from definitions, content preserved.
    assert "# My RFC" in body
    assert "## Context" in body and "## Proposal" in body
    assert "payments" in body


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fmt,mime,magic",
    [
        ("pdf", "application/pdf", b"%PDF-"),
        ("docx", "application/vnd.openxmlformats", b"PK\x03\x04"),
    ],
)
async def test_binary_export_for_pro(client_factory, fmt, mime, magic):
    doc_id = await _seed_document("u_exp_pro")
    async with client_factory(User(id="u_exp_pro", email="p@t.com", name="P", credits=5, plan="pro")) as client:
        res = await client.get(f"/api/documents/{doc_id}/export?format={fmt}")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith(mime)
    assert res.content[: len(magic)] == magic
    assert len(res.content) > 200


@pytest.mark.asyncio
@pytest.mark.parametrize("fmt", ["pdf", "docx"])
async def test_binary_export_blocked_for_free(client_factory, fmt):
    doc_id = await _seed_document("u_exp_free")
    async with client_factory(User(id="u_exp_free", email="f@t.com", name="F", credits=5, plan="free")) as client:
        res = await client.get(f"/api/documents/{doc_id}/export?format={fmt}")
    assert res.status_code == 403
    assert "pro" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unknown_format_rejected(client_factory):
    doc_id = await _seed_document("u_exp_bad")
    async with client_factory(User(id="u_exp_bad", email="b@t.com", name="B", credits=5, plan="pro")) as client:
        res = await client.get(f"/api/documents/{doc_id}/export?format=rtf")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_export_other_users_document_404(client_factory):
    doc_id = await _seed_document("u_exp_owner")
    async with client_factory(User(id="u_exp_other", email="o@t.com", name="O", credits=5, plan="pro")) as client:
        res = await client.get(f"/api/documents/{doc_id}/export?format=md")
    assert res.status_code == 404
