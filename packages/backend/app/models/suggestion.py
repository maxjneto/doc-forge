import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, false, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class Suggestion(Base):
    """A pending agent write awaiting human review (the 'PR model' for documents).

    The proposed content lives in a non-active SectionVersion
    (`proposed_version_id`); accepting activates it, rejecting leaves it
    inactive in the version tree. `base_version_id` records the active version
    at proposal time so the UI can flag stale suggestions.
    """

    __tablename__ = "suggestions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=False
    )
    proposed_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("section_versions.id", ondelete="CASCADE"), nullable=False
    )
    base_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("section_versions.id", ondelete="SET NULL"), nullable=True
    )
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document = relationship("Document", back_populates="suggestions")
    section = relationship("Section")
    proposed_version = relationship("SectionVersion", foreign_keys=[proposed_version_id])
    base_version = relationship("SectionVersion", foreign_keys=[base_version_id])
    api_key = relationship("ApiKey")

    __table_args__ = (
        Index("idx_suggestions_document_status", "document_id", "status"),
    )


class Feedback(Base):
    """Human feedback anchored to a document/section, consumable by agents via MCP.

    Created directly by a person (a comment) or automatically when a
    suggestion is rejected with a comment — closing the human→agent loop.

    Comments are conversations, the same shape as layout notes: a reply has
    `parent_id` and no status of its own (the root carries it). `anchor` is
    `{quote?, heading?}`: the text the comment is about and the heading it sat
    under, resolved against the current text on every read so it survives edits
    around it. `for_agent` marks a root as a request for the agent, which agents
    read first. An agent's reply carries `api_key_id`.
    """

    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=True
    )
    suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suggestions.id", ondelete="SET NULL"), nullable=True
    )
    author_user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback.id", ondelete="CASCADE"), nullable=True
    )
    anchor: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    for_agent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document = relationship("Document", back_populates="feedback_items")
    section = relationship("Section")
    suggestion = relationship("Suggestion")

    __table_args__ = (
        Index("idx_feedback_document_status", "document_id", "status"),
        Index("idx_feedback_parent", "parent_id"),
    )
