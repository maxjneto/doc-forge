"""add_index_documents_user_id

Revision ID: 004
Revises: 003
Create Date: 2025-05-05
"""

from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_documents_user_id", "documents", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_documents_user_id", table_name="documents")
