import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Artifact(Base):
    """Supporting material an agent (or human) attaches to a document.

    The apparatus *around* the text: a diagram that explains a flow, a table
    comparing options, a decision note recording why a paragraph says what it
    says. Agents used to produce this in the terminal, where it was lost,
    because DocForge only accepted "document content" — see
    docs/product/document-surface-revamp.md §5 Fase 4.

    Anchoring is explicit, not inferred: the document carries a
    `::artefato[key]` directive, so the anchor lives in the markdown, survives
    export, and never drifts when the surrounding text is rewritten. An
    artifact with no directive pointing at it is valid — it shows as
    `SEM ÂNCORA` in the panel.
    """

    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    # Referenced from the markdown as ::artefato[key] — unique per document.
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    # Closed set: "diagram" | "table" | "decision" (the three in the v4 mock).
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # Markdown. A diagram is a ```mermaid fence; the renderer already handles it.
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Author: exactly one of these is set.
    author_user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    revision: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    document = relationship("Document", back_populates="artifacts")
    api_key = relationship("ApiKey")

    __table_args__ = (
        UniqueConstraint("document_id", "key", name="uq_artifact_document_key"),
        Index("ix_artifacts_document", "document_id"),
    )


ARTIFACT_KINDS = ("diagram", "table", "decision")
