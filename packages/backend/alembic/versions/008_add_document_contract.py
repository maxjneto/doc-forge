"""add_document_contract

Revision ID: 008
Revises: 007
Create Date: 2026-05-09
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("entities", sa.JSON, nullable=True),
        sa.Column("decisions", sa.JSON, nullable=True),
        sa.Column("terminology", sa.JSON, nullable=True),
        sa.Column("constraints", sa.JSON, nullable=True),
        sa.Column("raw_contract", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_document_contracts_document_id", "document_contracts", ["document_id"])


def downgrade() -> None:
    op.drop_index("idx_document_contracts_document_id", table_name="document_contracts")
    op.drop_table("document_contracts")
