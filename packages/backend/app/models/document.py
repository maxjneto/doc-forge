import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    current_phase: Mapped[str] = mapped_column(String(30), nullable=False, default="discovery")
    document_context: Mapped[str] = mapped_column(Text, nullable=False)
    global_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_problems: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    sections = relationship("Section", back_populates="document", cascade="all, delete-orphan")
    discovery_questions = relationship("DiscoveryQuestion", back_populates="document", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="document", cascade="all, delete-orphan")
    audit_findings = relationship("AuditFinding", back_populates="document", cascade="all, delete-orphan")
    user = relationship("User", back_populates="documents")
