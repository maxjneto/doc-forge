"""Collaboration: who did what, and comments as conversations on Markdown.

- `document_activity.user_id`: the person behind each entry. Until now a
  person's action was recorded with no one attached, so a shared document
  showed every human as "You".
- `feedback`: replies (`parent_id`), an anchor in the text (`anchor`), requests
  addressed to the agent (`for_agent`) and agent authorship (`api_key_id`) — the
  shape layout notes already have.

Revision ID: 002
Revises: 001
Create Date: 2026-10-28
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('document_activity', sa.Column('user_id', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'fk_document_activity_user_id', 'document_activity', 'users', ['user_id'], ['id'], ondelete='SET NULL'
    )

    op.add_column('feedback', sa.Column('api_key_id', sa.UUID(), nullable=True))
    op.add_column('feedback', sa.Column('parent_id', sa.UUID(), nullable=True))
    op.add_column('feedback', sa.Column('anchor', sa.JSON(), nullable=True))
    op.add_column('feedback', sa.Column('for_agent', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_foreign_key('fk_feedback_api_key_id', 'feedback', 'api_keys', ['api_key_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_feedback_parent_id', 'feedback', 'feedback', ['parent_id'], ['id'], ondelete='CASCADE')
    op.create_index('idx_feedback_parent', 'feedback', ['parent_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_feedback_parent', table_name='feedback')
    op.drop_constraint('fk_feedback_parent_id', 'feedback', type_='foreignkey')
    op.drop_constraint('fk_feedback_api_key_id', 'feedback', type_='foreignkey')
    op.drop_column('feedback', 'for_agent')
    op.drop_column('feedback', 'anchor')
    op.drop_column('feedback', 'parent_id')
    op.drop_column('feedback', 'api_key_id')

    op.drop_constraint('fk_document_activity_user_id', 'document_activity', type_='foreignkey')
    op.drop_column('document_activity', 'user_id')
