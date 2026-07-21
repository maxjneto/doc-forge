"""add suggestions and feedback tables + document agent_write_policy

Revision ID: 018
Revises: 017
Create Date: 2026-07-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("agent_write_policy", sa.String(20), nullable=False, server_default="suggest"),
    )

    op.create_table(
        "suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", UUID(as_uuid=True), sa.ForeignKey("sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proposed_version_id", UUID(as_uuid=True), sa.ForeignKey("section_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("base_version_id", UUID(as_uuid=True), sa.ForeignKey("section_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("api_key_id", UUID(as_uuid=True), sa.ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_suggestions_document_status", "suggestions", ["document_id", "status"])

    op.create_table(
        "feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", UUID(as_uuid=True), sa.ForeignKey("sections.id", ondelete="CASCADE"), nullable=True),
        sa.Column("suggestion_id", UUID(as_uuid=True), sa.ForeignKey("suggestions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("author_user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_feedback_document_status", "feedback", ["document_id", "status"])


def downgrade() -> None:
    op.drop_index("idx_feedback_document_status", table_name="feedback")
    op.drop_table("feedback")
    op.drop_index("idx_suggestions_document_status", table_name="suggestions")
    op.drop_table("suggestions")
    op.drop_column("documents", "agent_write_policy")
