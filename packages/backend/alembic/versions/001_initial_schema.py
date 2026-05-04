"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("current_phase", sa.String(30), nullable=False, server_default="discovery"),
        sa.Column("document_context", sa.Text(), nullable=False),
        sa.Column("global_context", sa.Text(), nullable=True),
        sa.Column("user_preferences", sa.Text(), nullable=True),
        sa.Column("audit_problems", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index("idx_documents_phase", "documents", ["current_phase"])

    op.create_table(
        "sections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("document_id", "section_type", name="uq_document_section_type"),
    )

    op.create_table(
        "section_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("section_id", UUID(as_uuid=True), sa.ForeignKey("sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_version_id", UUID(as_uuid=True), sa.ForeignKey("section_versions.id"), nullable=True),
        sa.Column("version_name", sa.String(100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index(
        "idx_one_active_version",
        "section_versions",
        ["section_id"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", UUID(as_uuid=True), sa.ForeignKey("sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index("idx_chat_section", "chat_messages", ["section_id", "created_at"])

    op.create_table(
        "discovery_questions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("skipped", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index("idx_discovery_document", "discovery_questions", ["document_id", "created_at"])


def downgrade() -> None:
    op.drop_table("discovery_questions")
    op.drop_table("chat_messages")
    op.drop_table("section_versions")
    op.drop_table("sections")
    op.drop_table("documents")
