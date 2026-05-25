"""Tests for the service layer (db.py) — phase transitions and version management."""


import pytest

from app.models import Document, Section
from app.services import db as db_service


@pytest.mark.asyncio
async def test_set_phase(db_with_user, test_user):
    """set_phase updates document phase and updated_at."""
    db = db_with_user
    doc = Document(
        title="Test",
        document_context="ctx",
        user_id=test_user.id,
        current_phase="discovery",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    await db_service.set_phase(db, doc.id, "alignment")

    await db.refresh(doc)
    assert doc.current_phase == "alignment"


@pytest.mark.asyncio
async def test_create_section_version_deactivates_previous(db_with_user, test_user):
    """Creating a new version deactivates the previously active one."""
    db = db_with_user
    doc = Document(title="T", document_context="c", user_id=test_user.id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    section = Section(document_id=doc.id, section_type="context")
    db.add(section)
    await db.commit()
    await db.refresh(section)

    v1 = await db_service.create_section_version(db, section.id, "v1", "Content v1")
    assert v1.is_active is True

    v2 = await db_service.create_section_version(
        db, section.id, "v2", "Content v2", parent_version_id=v1.id
    )
    assert v2.is_active is True

    # v1 should now be inactive
    await db.refresh(v1)
    assert v1.is_active is False


@pytest.mark.asyncio
async def test_restore_version(db_with_user, test_user):
    """Restoring a version activates it and deactivates the current one."""
    db = db_with_user
    doc = Document(title="T", document_context="c", user_id=test_user.id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    section = Section(document_id=doc.id, section_type="proposal")
    db.add(section)
    await db.commit()
    await db.refresh(section)

    v1 = await db_service.create_section_version(db, section.id, "v1", "Original")
    v2 = await db_service.create_section_version(db, section.id, "v2", "Updated")

    # Restore v1
    restored = await db_service.restore_version(db, section.id, v1.id)
    assert restored.is_active is True

    await db.refresh(v2)
    assert v2.is_active is False


@pytest.mark.asyncio
async def test_all_sections_finalized(db_with_user, test_user):
    """all_sections_finalized returns True only when all are finalized."""
    db = db_with_user
    doc = Document(title="T", document_context="c", user_id=test_user.id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    s1 = Section(document_id=doc.id, section_type="context", status="refining")
    s2 = Section(document_id=doc.id, section_type="proposal", status="finalized")
    db.add_all([s1, s2])
    await db.commit()

    assert await db_service.all_sections_finalized(db, doc.id) is False

    await db_service.finalize_section(db, s1.id)
    assert await db_service.all_sections_finalized(db, doc.id) is True
