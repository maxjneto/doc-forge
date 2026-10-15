"""add document layout revisions

Revision ID: 036
Revises: 035
Create Date: 2026-10-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "036"
down_revision: Union[str, None] = "035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_layout_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("ops", sa.JSON(), nullable=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("author_user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "api_key_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("api_keys.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "uq_document_layout_revisions_doc_rev",
        "document_layout_revisions",
        ["document_id", "revision"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_document_layout_revisions_doc_rev", table_name="document_layout_revisions")
    op.drop_table("document_layout_revisions")
