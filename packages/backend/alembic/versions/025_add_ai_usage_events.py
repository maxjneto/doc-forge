"""add_ai_usage_events

Revision ID: 025
Revises: 024
Create Date: 2026-07-21

Backs the per-user rate limit on free AI-assisted actions (currently: section
role_description generation on the Customize page). One row per call; the
endpoint counts rows in the trailing window instead of tracking a counter in
Redis/memory, since REDIS_URL is optional and Postgres is already the source
of truth for counters elsewhere (credits).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_usage_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_ai_usage_events_user_kind_created",
        "ai_usage_events",
        ["user_id", "kind", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_usage_events_user_kind_created", table_name="ai_usage_events")
    op.drop_table("ai_usage_events")
