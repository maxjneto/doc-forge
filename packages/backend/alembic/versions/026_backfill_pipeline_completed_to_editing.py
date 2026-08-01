"""backfill_pipeline_completed_to_editing

Revision ID: 026
Revises: 025
Create Date: 2026-07-23

Fase 2/ponto 6 of docs/product/pipeline-collaboration-implementation.md
(A-lite): BYOA pipeline documents (document_mode='pipeline') now hand off to
the free editor instead of the old dedicated completed screen — see
app/services/pipeline.py's _handoff_to_editing/_concatenate_sections_to_body.

Scoped to document_mode='pipeline' ONLY. Hosted/guided documents
(document_mode='guided') still reach current_phase='completed' via
app/phases/completion/function.py and still use CompletedLayout — that flow
was not part of this decision and this migration must not touch it.

For each already-completed pipeline document, synthesizes the same `body`
section content _concatenate_sections_to_body produces at runtime (the N
pipeline sections, in SectionDefinition order, each as a '## <display_name>'
Markdown block) so pre-existing documents don't land in an empty editor.
"""
import datetime
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


documents = sa.table(
    "documents",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("document_type_id", UUID(as_uuid=True)),
    sa.column("current_phase", sa.String),
    sa.column("document_mode", sa.String),
)
sections = sa.table(
    "sections",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("document_id", UUID(as_uuid=True)),
    sa.column("section_type", sa.String),
    sa.column("status", sa.String),
)
section_versions = sa.table(
    "section_versions",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("section_id", UUID(as_uuid=True)),
    sa.column("version_name", sa.String),
    sa.column("content", sa.Text),
    sa.column("is_active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
)
section_definitions = sa.table(
    "section_definitions",
    sa.column("document_type_id", UUID(as_uuid=True)),
    sa.column("section_key", sa.String),
    sa.column("display_name", sa.String),
    sa.column("order", sa.Integer),
)


def _concatenate(conn, doc_id, document_type_id: str | None) -> str:
    if document_type_id is None:
        return ""
    defs = conn.execute(
        sa.select(section_definitions.c.section_key, section_definitions.c.display_name)
        .where(section_definitions.c.document_type_id == document_type_id)
        .order_by(section_definitions.c.order)
    ).fetchall()

    blocks = []
    for section_key, display_name in defs:
        content_row = conn.execute(
            sa.select(section_versions.c.content)
            .select_from(
                sections.join(section_versions, sections.c.id == section_versions.c.section_id)
            )
            .where(
                sections.c.document_id == doc_id,
                sections.c.section_type == section_key,
                section_versions.c.is_active.is_(True),
            )
        ).first()
        content = ((content_row[0] if content_row else "") or "").strip()
        if content:
            blocks.append(f"## {display_name}\n\n{content}")
    return "\n\n".join(blocks)


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.datetime.now(datetime.timezone.utc)

    rows = conn.execute(
        sa.select(documents.c.id, documents.c.document_type_id).where(
            documents.c.current_phase == "completed",
            documents.c.document_mode == "pipeline",
        )
    ).fetchall()

    for doc_id, document_type_id in rows:
        concatenated = _concatenate(conn, doc_id, document_type_id)

        existing_body = conn.execute(
            sa.select(sections.c.id).where(
                sections.c.document_id == doc_id, sections.c.section_type == "body"
            )
        ).first()

        if existing_body is None:
            body_id = uuid.uuid4()
            conn.execute(
                sections.insert().values(
                    id=body_id, document_id=doc_id, section_type="body", status="finalized",
                )
            )
        else:
            body_id = existing_body[0]
            conn.execute(
                section_versions.update()
                .where(
                    section_versions.c.section_id == body_id,
                    section_versions.c.is_active.is_(True),
                )
                .values(is_active=False)
            )

        conn.execute(
            section_versions.insert().values(
                id=uuid.uuid4(),
                section_id=body_id,
                version_name="Pipeline complete (backfilled)",
                content=concatenated,
                is_active=True,
                created_at=now,
            )
        )

    conn.execute(
        documents.update()
        .where(documents.c.current_phase == "completed", documents.c.document_mode == "pipeline")
        .values(current_phase="editing")
    )


def downgrade() -> None:
    conn = op.get_bind()
    # Best-effort: only the phase flip is reversed. There is no reliable way
    # to tell a document backfilled by upgrade() apart from one that reached
    # "editing" naturally after this migration (both look identical), so the
    # synthesized/backfilled `body` section+version is intentionally left in
    # place rather than guessed-deleted — a hand-edited body would otherwise
    # be silently destroyed on downgrade.
    conn.execute(
        documents.update()
        .where(documents.c.current_phase == "editing", documents.c.document_mode == "pipeline")
        .values(current_phase="completed")
    )
