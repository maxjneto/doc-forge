import uuid
from datetime import datetime

from sqlalchemy import Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DocumentContract(Base):
    """Compact structured contract extracted after alignment approval.

    Persisted once per document. Downstream phases (generation, refinement, audit)
    inject it into their prompt context so all sections share a single source of truth.
    """

    __tablename__ = "document_contracts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Structured fields — JSON arrays/objects
    entities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    decisions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    terminology: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    constraints: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Full raw text returned by the AI (for debugging / display)
    raw_contract: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    document = relationship("Document", back_populates="contract")
