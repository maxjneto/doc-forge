"""add pipeline_definitions table and document_types.user_id (custom types)

Revision ID: 021
Revises: 020
Create Date: 2026-07-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pipeline_definitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("base_document_type_id", UUID(as_uuid=True), sa.ForeignKey("document_types.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_definitions_user_id", "pipeline_definitions", ["user_id"])

    op.add_column(
        "document_types",
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("document_types", "user_id")
    op.drop_index("ix_pipeline_definitions_user_id", table_name="pipeline_definitions")
    op.drop_table("pipeline_definitions")
