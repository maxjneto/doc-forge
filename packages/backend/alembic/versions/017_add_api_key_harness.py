"""add harness column to api_keys

Revision ID: 017
Revises: 016
Create Date: 2026-05-24

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("api_keys", sa.Column("harness", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("api_keys", "harness")
