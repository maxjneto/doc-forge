"""add users table and user_id to documents

Revision ID: 003
Revises: 002
Create Date: 2026-05-04

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("credits", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Add user_id as nullable first to allow backfilling
    op.add_column("documents", sa.Column("user_id", sa.String(255), nullable=True))
    op.create_foreign_key(
        "fk_documents_user_id",
        "documents",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Any existing documents (dev data) have no owner — drop them so we can enforce NOT NULL
    op.execute("DELETE FROM documents")

    op.alter_column("documents", "user_id", nullable=False)


def downgrade() -> None:
    op.drop_constraint("fk_documents_user_id", "documents", type_="foreignkey")
    op.drop_column("documents", "user_id")
    op.drop_table("users")
