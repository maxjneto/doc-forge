"""add credit period tracking

Revision ID: 032
Revises: 031
Create Date: 2026-08-11

NULL is deliberate for existing rows: the first authenticated request treats
it as an expired period and restores the account immediately.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "032"
down_revision: Union[str, None] = "031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("credits_reset_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "credits_reset_at")
