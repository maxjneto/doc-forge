"""add_published_version

Revision ID: 028
Revises: 027
Create Date: 2026-08-03

The v4 mock assumes a vocabulary the model did not have: `IN REVIEW · V5 DRAFT`
in the document bar, `v4 → v5 draft` in the editor title, and a `Publicar v5`
button the quality gate can block.

That is a published-plus-draft model, closer to git than to a single "active"
pointer: the active version is the working draft, and `is_published` marks the
last snapshot someone deliberately signed off on. Nothing is published by
default — a document with no published version simply reads as a draft.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "section_versions",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "section_versions",
        sa.Column("published_at", sa.DateTime(), nullable=True),
    )
    # At most one published version per section.
    op.create_index(
        "idx_one_published_version",
        "section_versions",
        ["section_id"],
        unique=True,
        postgresql_where=sa.text("is_published"),
    )


def downgrade() -> None:
    op.drop_index("idx_one_published_version", table_name="section_versions")
    op.drop_column("section_versions", "published_at")
    op.drop_column("section_versions", "is_published")
