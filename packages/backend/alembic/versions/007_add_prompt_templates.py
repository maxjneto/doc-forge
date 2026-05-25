"""add_prompt_templates

Revision ID: 007
Revises: 006
Create Date: 2026-05-09
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prompt_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_types.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phase", sa.String(30), nullable=False),
        sa.Column("section_key", sa.String(50), nullable=True),
        sa.Column("prompt_text", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(
        "idx_prompt_templates_lookup",
        "prompt_templates",
        ["document_type_id", "phase", "section_key"],
    )


def downgrade() -> None:
    op.drop_index("idx_prompt_templates_lookup", table_name="prompt_templates")
    op.drop_table("prompt_templates")
