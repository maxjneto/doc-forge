"""add document_mode to documents

Revision ID: 014
Revises: 013
Create Date: 2026-05-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("document_mode", sa.String(20), nullable=False, server_default="guided"),
    )


def downgrade() -> None:
    op.drop_column("documents", "document_mode")
