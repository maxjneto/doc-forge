"""add require_gate_on_accept to documents

Revision ID: 022
Revises: 021
Create Date: 2026-07-18

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("require_gate_on_accept", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("documents", "require_gate_on_accept")
