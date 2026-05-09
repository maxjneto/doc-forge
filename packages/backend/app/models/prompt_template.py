import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PromptTemplate(Base):
    """Stores phase/section-level prompt text for a document type.

    Placeholders supported in prompt_text:
      {{discovery_context}}   — consolidated discovery context
      {{user_preferences}}    — user preferences string
      {{section_summary}}     — approved alignment summary for the section
      {{section_content}}     — current full section content
      {{cross_section}}       — cross-section reference block
      {{chat_history}}        — not interpolated here; handled by context builder directly
      {{contract}}            — rendered document contract block
    """

    __tablename__ = "prompt_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_types.id", ondelete="CASCADE"), nullable=False
    )
    # e.g. "discovery", "alignment", "generation", "refinement", "audit", "coherence"
    phase: Mapped[str] = mapped_column(String(30), nullable=False)
    # null = applies to all sections of the phase; set to section_key for section-specific prompts
    section_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    document_type = relationship("DocumentType", back_populates="prompt_templates")
