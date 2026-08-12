"""add_folders_and_sharing

Revision ID: 029
Revises: 028
Create Date: 2026-08-04

Turns DocForge from "a list of one user's documents" into a place documents
live in: folders to file them, and membership so someone else can read,
comment on, or edit one.

`principal_type` is 'user' throughout for now. It exists so sharing with a
whole workspace later is a new value rather than a new table — the choice
between per-document sharing and Clerk Organizations is still open
(docs/product/document-organization.md §4).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("folders.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_folders_user_parent", "folders", ["user_id", "parent_id"])

    op.add_column(
        "documents",
        sa.Column("folder_id", UUID(as_uuid=True), sa.ForeignKey("folders.id", ondelete="SET NULL"), nullable=True),
    )

    op.create_table(
        "document_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("principal_type", sa.String(20), nullable=False, server_default="user"),
        sa.Column("principal_id", sa.String(255), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("invited_email", sa.String(320), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("invited_by", sa.String(255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint(
        "uq_member_document_email", "document_members", ["document_id", "invited_email"]
    )
    op.create_index("ix_document_members_principal", "document_members", ["principal_id"])


def downgrade() -> None:
    op.drop_index("ix_document_members_principal", table_name="document_members")
    op.drop_constraint("uq_member_document_email", "document_members", type_="unique")
    op.drop_table("document_members")
    op.drop_column("documents", "folder_id")
    op.drop_index("ix_folders_user_parent", table_name="folders")
    op.drop_table("folders")
