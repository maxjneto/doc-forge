"""Baseline: the whole schema as of the first public release.

Generated from the models and checked against the old 38-migration chain: the
only differences are what was removed with the hosted guided workflow (its nine
tables, the document phase/context columns and the section summary columns).
Older databases are not upgraded from here; start them fresh.

Revision ID: 001
Revises:
Create Date: 2026-10-28
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=True),
    sa.Column('credits', sa.Integer(), nullable=False),
    sa.Column('credits_reset_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('plan', sa.String(length=20), nullable=False),
    sa.Column('stripe_customer_id', sa.String(length=255), nullable=True),
    sa.Column('stripe_subscription_id', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('stripe_customer_id')
    )
    op.create_table('api_keys',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('key_hash', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('harness', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('key_hash')
    )
    op.create_index('ix_api_keys_user_id', 'api_keys', ['user_id'], unique=False)
    op.create_table('folders',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('parent_id', sa.UUID(), nullable=True),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['parent_id'], ['folders.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_folders_user_parent', 'folders', ['user_id', 'parent_id'], unique=False)
    op.create_table('documents',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('folder_id', sa.UUID(), nullable=True),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('document_mode', sa.String(length=20), nullable=False),
    sa.Column('agent_write_policy', sa.String(length=20), nullable=False),
    sa.Column('require_gate_on_accept', sa.Boolean(), nullable=False),
    sa.Column('public_token', sa.String(length=64), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('public_token')
    )
    op.create_index('idx_documents_user_id', 'documents', ['user_id'], unique=False)
    op.create_index('ix_documents_user_active', 'documents', ['user_id', 'archived_at'], unique=False)
    op.create_table('layout_themes',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('tokens', sa.JSON(), nullable=False),
    sa.Column('api_key_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_layout_themes_user', 'layout_themes', ['user_id'], unique=False)
    op.create_table('artifacts',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('key', sa.String(length=100), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('author_user_id', sa.String(length=255), nullable=True),
    sa.Column('api_key_id', sa.UUID(), nullable=True),
    sa.Column('revision', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('document_id', 'key', name='uq_artifact_document_key')
    )
    op.create_index('ix_artifacts_document', 'artifacts', ['document_id'], unique=False)
    op.create_table('audit_findings',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('section_type', sa.String(length=20), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('severity', sa.String(length=10), nullable=False),
    sa.Column('quote', sa.Text(), nullable=True),
    sa.Column('category', sa.String(length=40), nullable=True),
    sa.Column('dismissed', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_findings_document_id', 'audit_findings', ['document_id'], unique=False)
    op.create_table('document_layout_revisions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('revision', sa.Integer(), nullable=False),
    sa.Column('ops', sa.JSON(), nullable=True),
    sa.Column('content', sa.JSON(), nullable=False),
    sa.Column('author_user_id', sa.String(length=255), nullable=True),
    sa.Column('api_key_id', sa.UUID(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('name', sa.String(length=120), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_document_layout_revisions_doc_rev', 'document_layout_revisions', ['document_id', 'revision'], unique=True)
    op.create_table('document_layouts',
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.JSON(), nullable=False),
    sa.Column('revision', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('published_content', sa.JSON(), nullable=True),
    sa.Column('published_revision', sa.Integer(), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('document_id')
    )
    op.create_table('document_members',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('principal_type', sa.String(length=20), nullable=False),
    sa.Column('principal_id', sa.String(length=255), nullable=True),
    sa.Column('invited_email', sa.String(length=320), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('invited_by', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['principal_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('document_id', 'invited_email', name='uq_member_document_email')
    )
    op.create_index('ix_document_members_principal', 'document_members', ['principal_id'], unique=False)
    op.create_table('layout_notes',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('code', sa.String(length=40), nullable=True),
    sa.Column('severity', sa.String(length=10), nullable=False),
    sa.Column('anchor', sa.JSON(), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('data', sa.JSON(), nullable=True),
    sa.Column('revision', sa.Integer(), nullable=False),
    sa.Column('author_user_id', sa.String(length=255), nullable=True),
    sa.Column('api_key_id', sa.UUID(), nullable=True),
    sa.Column('parent_id', sa.UUID(), nullable=True),
    sa.Column('for_agent', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('resolution_note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['parent_id'], ['layout_notes.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_layout_notes_document_status', 'layout_notes', ['document_id', 'status'], unique=False)
    op.create_index('idx_layout_notes_parent', 'layout_notes', ['parent_id'], unique=False)
    op.create_table('sections',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('section_type', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('document_id', 'section_type', name='uq_document_section_type')
    )
    op.create_table('section_versions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('section_id', sa.UUID(), nullable=False),
    sa.Column('parent_version_id', sa.UUID(), nullable=True),
    sa.Column('version_name', sa.String(length=100), nullable=False),
    sa.Column('change_summary', sa.String(length=500), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_published', sa.Boolean(), nullable=False),
    sa.Column('published_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['parent_version_id'], ['section_versions.id'], ),
    sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_one_active_version', 'section_versions', ['section_id'], unique=True, postgresql_where=sa.text('is_active IS true'))
    op.create_index('idx_one_published_version', 'section_versions', ['section_id'], unique=True, postgresql_where=sa.text('is_published IS true'), sqlite_where=sa.text('is_published IS true'))
    op.create_table('document_activity',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('api_key_id', sa.UUID(), nullable=True),
    sa.Column('action_type', sa.String(length=30), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('bytes_delta', sa.Integer(), nullable=True),
    sa.Column('version_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['version_id'], ['section_versions.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_document_activity_document_id', 'document_activity', ['document_id'], unique=False)
    op.create_table('suggestions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('section_id', sa.UUID(), nullable=False),
    sa.Column('proposed_version_id', sa.UUID(), nullable=False),
    sa.Column('base_version_id', sa.UUID(), nullable=True),
    sa.Column('api_key_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('review_comment', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['base_version_id'], ['section_versions.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['proposed_version_id'], ['section_versions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_suggestions_document_status', 'suggestions', ['document_id', 'status'], unique=False)
    op.create_table('feedback',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('section_id', sa.UUID(), nullable=True),
    sa.Column('suggestion_id', sa.UUID(), nullable=True),
    sa.Column('author_user_id', sa.String(length=255), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('resolution_note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['suggestion_id'], ['suggestions.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_feedback_document_status', 'feedback', ['document_id', 'status'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_feedback_document_status', table_name='feedback')
    op.drop_table('feedback')
    op.drop_index('idx_suggestions_document_status', table_name='suggestions')
    op.drop_table('suggestions')
    op.drop_index('ix_document_activity_document_id', table_name='document_activity')
    op.drop_table('document_activity')
    op.drop_index('idx_one_published_version', table_name='section_versions', postgresql_where=sa.text('is_published IS true'), sqlite_where=sa.text('is_published IS true'))
    op.drop_index('idx_one_active_version', table_name='section_versions', postgresql_where=sa.text('is_active IS true'))
    op.drop_table('section_versions')
    op.drop_table('sections')
    op.drop_index('idx_layout_notes_parent', table_name='layout_notes')
    op.drop_index('idx_layout_notes_document_status', table_name='layout_notes')
    op.drop_table('layout_notes')
    op.drop_index('ix_document_members_principal', table_name='document_members')
    op.drop_table('document_members')
    op.drop_table('document_layouts')
    op.drop_index('uq_document_layout_revisions_doc_rev', table_name='document_layout_revisions')
    op.drop_table('document_layout_revisions')
    op.drop_index('idx_audit_findings_document_id', table_name='audit_findings')
    op.drop_table('audit_findings')
    op.drop_index('ix_artifacts_document', table_name='artifacts')
    op.drop_table('artifacts')
    op.drop_index('idx_layout_themes_user', table_name='layout_themes')
    op.drop_table('layout_themes')
    op.drop_index('ix_documents_user_active', table_name='documents')
    op.drop_index('idx_documents_user_id', table_name='documents')
    op.drop_table('documents')
    op.drop_index('ix_folders_user_parent', table_name='folders')
    op.drop_table('folders')
    op.drop_index('ix_api_keys_user_id', table_name='api_keys')
    op.drop_table('api_keys')
    op.drop_table('users')
