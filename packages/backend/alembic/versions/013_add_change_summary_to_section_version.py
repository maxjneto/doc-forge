"""add change_summary to section_version

Revision ID: 013
Revises: 012
Create Date: 2026-05-20

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("section_versions", sa.Column("change_summary", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("section_versions", "change_summary")
