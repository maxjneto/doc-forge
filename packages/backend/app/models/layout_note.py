import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base


class LayoutNote(Base):
    """A note pinned to part of a layout document, readable by people and agents.

    Two kinds share one table because they share an anchor, a lifecycle and a
    reader:
    - `notice`: written by the backend when a write made the layout do something
      on its own (a box pushed to another page, a split, the page limit…). `code`
      is the layout service's change code.
    - `annotation`: written by a person (or an agent) about an area or a component.

    `anchor` is `{component?, rect?}` (rect in grid units, optionally with a page).
    Positions move with the layout, so readers resolve the anchor on every read;
    the anchor itself never stores a computed position.

    Separate from `Feedback` on purpose: that one belongs to Markdown documents
    and their sections.
    """

    __tablename__ = "layout_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    severity: Mapped[str] = mapped_column(String(10), nullable=False, default="info")
    anchor: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # The layout revision the note was written against.
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    author_user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("idx_layout_notes_document_status", "document_id", "status"),)


class DocumentLayoutRevision(Base):
    """One accepted write of a layout document: who, which ops, and the result.

    `content` is the whole document after the write, so any revision can be read
    back or restored without replaying operations.
    """

    __tablename__ = "document_layout_revisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    # The operations of the write; null for a whole-document replace or the creation.
    ops: Mapped[list | None] = mapped_column(JSON, nullable=True)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    author_user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("uq_document_layout_revisions_doc_rev", "document_id", "revision", unique=True),
    )
