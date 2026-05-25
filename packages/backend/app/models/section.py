import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    section_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovery_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    document = relationship("Document", back_populates="sections")
    versions = relationship("SectionVersion", back_populates="section", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="section", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("document_id", "section_type", name="uq_document_section_type"),
    )


class SectionVersion(Base):
    __tablename__ = "section_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    parent_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("section_versions.id"), nullable=True)
    version_name: Mapped[str] = mapped_column(String(100), nullable=False)
    change_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    section = relationship("Section", back_populates="versions")
    parent_version = relationship("SectionVersion", remote_side="SectionVersion.id")

    __table_args__ = (
        Index("idx_one_active_version", "section_id", unique=True, postgresql_where=(is_active.is_(True))),
    )
