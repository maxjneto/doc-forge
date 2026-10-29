"""Tests for the service layer (db.py) — version management."""


import pytest

from app.models import Document, Section
from app.services import db as db_service


@pytest.mark.asyncio
async def test_create_section_version_deactivates_previous(db_with_user, test_user):
    """Creating a new version deactivates the previously active one."""
    db = db_with_user
    doc = Document(title="T", user_id=test_user.id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    section = Section(document_id=doc.id, section_type="body")
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
    doc = Document(title="T", user_id=test_user.id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    section = Section(document_id=doc.id, section_type="body")
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
