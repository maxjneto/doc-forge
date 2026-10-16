import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class DocumentLayout(Base):
    """The content of a layout document (document_mode="layout").

    `content` is the whole @docforge/layout document (components placed on a
    grid). It is only ever written after the layout service accepted it, and
    `revision` goes up by one on every accepted write so a client can detect
    that someone else wrote in between.
    """

    __tablename__ = "document_layouts"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # What the public link serves: a snapshot taken on "Publish", so later edits
    # stay private until the next one. Null = not published.
    published_content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    published_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document = relationship("Document", back_populates="layout")
