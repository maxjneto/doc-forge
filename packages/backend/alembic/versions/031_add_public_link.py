"""add_public_link

Revision ID: 031
Revises: 030
Create Date: 2026-08-04

A read-only link for people without an account. The token is the capability:
holding it grants read, so it is unguessable and revocable by clearing the
column. Null means the document is not publicly readable, which is the default
and the state every existing document starts in.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("public_token", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_documents_public_token", "documents", ["public_token"])


def downgrade() -> None:
    op.drop_constraint("uq_documents_public_token", "documents", type_="unique")
    op.drop_column("documents", "public_token")
