"""The cookie choice, kept on the account.

`users.analytics_consent`: "accepted" | "declined" | NULL (never answered). The
browser sends it after the banner; server-side analytics about the account are
anonymous (a pseudonym, no person profile) unless it is "accepted".

Revision ID: 004
Revises: 003
Create Date: 2026-11-04
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('analytics_consent', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'analytics_consent')
