"""add_document_type_fk

Revision ID: 010
Revises: 009
Create Date: 2026-05-09

Adds document_type_id FK to documents table.
Backfills existing rows with the RFC document type.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column(
            "document_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_types.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_documents_document_type_id", "documents", ["document_type_id"])

    # Backfill existing documents with the RFC document type
    op.execute("""
        UPDATE documents
        SET document_type_id = (SELECT id FROM document_types WHERE slug = 'rfc')
        WHERE document_type_id IS NULL
    """)


def downgrade() -> None:
    op.drop_index("idx_documents_document_type_id", table_name="documents")
    op.drop_column("documents", "document_type_id")
