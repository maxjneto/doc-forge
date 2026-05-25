"""per_section_discovery

Revision ID: 011
Revises: 010
Create Date: 2026-05-10

Adds section_key to discovery_questions and discovery_context to sections
to support the per-section discovery redesign.
"""

import sqlalchemy as sa

from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "discovery_questions",
        sa.Column("section_key", sa.String(50), nullable=True),
    )
    op.create_index(
        "idx_discovery_section",
        "discovery_questions",
        ["document_id", "section_key", "created_at"],
    )

    op.add_column(
        "sections",
        sa.Column("discovery_context", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sections", "discovery_context")
    op.drop_index("idx_discovery_section", table_name="discovery_questions")
    op.drop_column("discovery_questions", "section_key")
