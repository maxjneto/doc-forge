"""add_finding_quote

Revision ID: 030
Revises: 029
Create Date: 2026-08-04

The v4 gate screen renders a finding *inside the text*, with the offending
phrase underlined. That needs the finding to say which words it is about —
until now it only carried a prose description, so it could never be placed
more precisely than "somewhere in this document".

Nullable on purpose: a finding about the document as a whole ("the intro
promises something the body never delivers") has no single phrase to point at,
and the anchor resolver degrades to section, then to document.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audit_findings", sa.Column("quote", sa.Text(), nullable=True))
    op.add_column("audit_findings", sa.Column("category", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_findings", "category")
    op.drop_column("audit_findings", "quote")
