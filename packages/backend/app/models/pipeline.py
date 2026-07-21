import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class PipelineDefinition(Base):
    """A user-owned, editable pipeline: cloned from a baseline, prompts and
    steps customizable as structured text (no visual editor in v1).

    `steps` uses the same shape as PipelineRun.steps minus runtime fields:
    [{"phase", "section_key" | None, "prompt"?: str, "checkpoint"?: "human"}].
    A step's `prompt` overrides the default PromptTemplate/YAML prompt.
    """

    __tablename__ = "pipeline_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    base_document_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_types.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    steps: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    base_document_type = relationship("DocumentType")


class PipelineRun(Base):
    """Durable state of a BYOA pipeline over a document.

    The user's agent executes each step via MCP (get_next_step / submit_step);
    the server owns the state machine, validates submissions, and blocks at
    human checkpoints. `steps` is a JSON snapshot built at start time so a run
    is stable and resumable even if the underlying definition changes later.
    """

    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    definition_slug: Mapped[str] = mapped_column(String(50), nullable=False, default="rfc-baseline")
    # [{"index", "phase", "section_key" | None, "status": pending|done, "submitted_at"}]
    steps: Mapped[list] = mapped_column(JSON, nullable=False)
    current_step_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # running | waiting_human | completed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    document = relationship("Document")
