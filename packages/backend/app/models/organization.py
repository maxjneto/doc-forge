import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Folder(Base):
    """A place to put documents.

    Nestable via `parent_id`. Folders belong to a user; sharing is per
    document, so a folder is purely the owner's own filing — an invited
    reviewer sees the documents they were given, not the shelf they sit on.
    """

    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    parent = relationship("Folder", remote_side="Folder.id", back_populates="children")
    children = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_folders_user_parent", "user_id", "parent_id"),)


# Ordered from least to most capable — `ROLE_RANK` makes "at least commenter"
# a comparison rather than a list of special cases.
ROLES = ("viewer", "commenter", "editor")
ROLE_RANK = {role: i for i, role in enumerate(ROLES)}
OWNER_ROLE = "owner"


class DocumentMember(Base):
    """Someone other than the owner who can reach a document.

    `principal_type` is 'user' today. It exists so that sharing with a whole
    workspace later is a new value rather than a new table — the decision
    between per-document sharing and workspaces is still open, and this keeps
    both reachable.
    """

    __tablename__ = "document_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    principal_type: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    # Clerk user id once the invitee has an account.
    principal_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # Invitations are addressed by email, so someone can be invited before
    # they have ever signed in.
    invited_email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    invited_by: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    document = relationship("Document", back_populates="members")

    __table_args__ = (
        UniqueConstraint("document_id", "invited_email", name="uq_member_document_email"),
        Index("ix_document_members_principal", "principal_id"),
    )
