"""Suggestions keep the text they were written against.

`suggestions.base_content`: people's edits save in place on the active
version, so the base version no longer holds what the agent saw. With the text
kept, accepting replays the agent's changes on what people wrote since instead
of overwriting it. Older suggestions keep NULL and the old behaviour.

Revision ID: 003
Revises: 002
Create Date: 2026-11-02
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('suggestions', sa.Column('base_content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('suggestions', 'base_content')
