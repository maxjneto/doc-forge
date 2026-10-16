"""published version of layout documents; layout format 3

Revision ID: 038
Revises: 037
Create Date: 2026-10-16

A layout document can be published: `published_content` is the snapshot that
its public link serves (the editor keeps changing `content`; readers see the
new state only after another "Publish").

@docforge-lib/layout 0.5 raised the format to 3 (0.4 added the Slide page size
while still writing 2). Version 2 and 3 have the same shape, so stored documents
only get the new number.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "038"
down_revision: Union[str, None] = "037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("document_layouts", "document_layout_revisions")


def _set_version(table: str, old: int, new: int) -> None:
    op.execute(
        f"UPDATE {table} SET content = jsonb_set(content::jsonb, '{{version}}', '{new}')::json "
        f"WHERE content->>'version' = '{old}'"
    )


def upgrade() -> None:
    op.add_column("document_layouts", sa.Column("published_content", sa.JSON(), nullable=True))
    op.add_column("document_layouts", sa.Column("published_revision", sa.Integer(), nullable=True))
    op.add_column("document_layouts", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    for table in _TABLES:
        _set_version(table, 2, 3)


def downgrade() -> None:
    for table in _TABLES:
        _set_version(table, 3, 2)
    op.drop_column("document_layouts", "published_at")
    op.drop_column("document_layouts", "published_revision")
    op.drop_column("document_layouts", "published_content")
