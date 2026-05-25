import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DocumentActivity(Base):
    __tablename__ = "document_activity"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    bytes_delta: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("section_versions.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    api_key = relationship("ApiKey")
