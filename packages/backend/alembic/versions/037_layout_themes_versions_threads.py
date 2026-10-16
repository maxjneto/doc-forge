"""layout themes, named layout versions, comment threads

Revision ID: 037
Revises: 036
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "037"
down_revision: Union[str, None] = "036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "layout_themes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tokens", sa.JSON(), nullable=False),
        sa.Column(
            "api_key_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("api_keys.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_layout_themes_user", "layout_themes", ["user_id"])

    op.add_column("document_layout_revisions", sa.Column("name", sa.String(120), nullable=True))
    op.add_column("document_layout_revisions", sa.Column("note", sa.Text(), nullable=True))

    op.add_column(
        "layout_notes",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("layout_notes.id", ondelete="CASCADE"), nullable=True),
    )
    op.add_column("layout_notes", sa.Column("for_agent", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_index("idx_layout_notes_parent", "layout_notes", ["parent_id"])


def downgrade() -> None:
    op.drop_index("idx_layout_notes_parent", table_name="layout_notes")
    op.drop_column("layout_notes", "for_agent")
    op.drop_column("layout_notes", "parent_id")
    op.drop_column("document_layout_revisions", "note")
    op.drop_column("document_layout_revisions", "name")
    op.drop_index("idx_layout_themes_user", table_name="layout_themes")
    op.drop_table("layout_themes")
