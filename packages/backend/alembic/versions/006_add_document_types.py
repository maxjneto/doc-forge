"""add_document_types

Revision ID: 006
Revises: 005
Create Date: 2026-05-09
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_document_types_slug", "document_types", ["slug"])

    op.create_table(
        "section_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_types.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section_key", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("role_description", sa.Text, nullable=False),
    )
    op.create_index(
        "idx_section_definitions_document_type_id",
        "section_definitions",
        ["document_type_id"],
    )

    # Seed RFC document type
    op.execute("""
        INSERT INTO document_types (id, slug, name, description, is_active)
        VALUES (
            gen_random_uuid(),
            'rfc',
            'RFC',
            'Propose and align on a technical decision or process change.',
            true
        )
    """)

    op.execute("""
        INSERT INTO section_definitions (id, document_type_id, section_key, display_name, "order", role_description)
        SELECT
            gen_random_uuid(),
            dt.id,
            s.section_key,
            s.display_name,
            s.ord,
            s.role_description
        FROM document_types dt,
        (VALUES
            ('context',        'Context',        1, 'Describes the problem, its impact, and why action is needed now.'),
            ('proposal',       'Proposal',       2, 'Presents the chosen solution, key design decisions, and architecture.'),
            ('implementation', 'Implementation', 3, 'Details the technical implementation plan, component changes, and rollout strategy.'),
            ('risks',          'Risks',          4, 'Lists real risks, mitigations, and discarded alternatives.')
        ) AS s(section_key, display_name, ord, role_description)
        WHERE dt.slug = 'rfc'
    """)


def downgrade() -> None:
    op.drop_index("idx_section_definitions_document_type_id", table_name="section_definitions")
    op.drop_table("section_definitions")
    op.drop_index("idx_document_types_slug", table_name="document_types")
    op.drop_table("document_types")
