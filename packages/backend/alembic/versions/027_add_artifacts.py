"""add_artifacts

Revision ID: 027
Revises: 026
Create Date: 2026-08-03

Artifacts are the supporting material around the text — diagrams, tables and
decision notes that agents used to produce in the terminal, where it was lost.
Anchoring is explicit: the markdown carries a `::artefato[key]` directive, so
the anchor survives export and never drifts. An artifact with no directive
pointing at it is valid (shown as SEM ÂNCORA), which is why there is no
anchor column here.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "artifacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "author_user_id",
            sa.String(255),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "api_key_id",
            UUID(as_uuid=True),
            sa.ForeignKey("api_keys.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_artifact_document_key", "artifacts", ["document_id", "key"])
    op.create_index("ix_artifacts_document", "artifacts", ["document_id"])


def downgrade() -> None:
    op.drop_index("ix_artifacts_document", table_name="artifacts")
    op.drop_constraint("uq_artifact_document_key", "artifacts", type_="unique")
    op.drop_table("artifacts")
