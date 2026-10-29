"""Who can do what with a document.

Until now every endpoint asked the same question inline — `doc.user_id ==
current_user.id` — which is exactly the check that has to change once a
document can be shared. This module is the one place that answers it.

Roles, least to most capable: viewer · commenter · editor · owner.
"""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, DocumentMember
from app.models.organization import OWNER_ROLE, ROLE_RANK
from app.models.user import User

Capability = Literal["read", "comment", "write", "manage"]

# What each role is allowed to do. `manage` covers sharing and deletion, and
# stays with the owner: an editor can rewrite the document but cannot decide
# who else gets in.
_REQUIRED_RANK: dict[Capability, int] = {
    "read": ROLE_RANK["viewer"],
    "comment": ROLE_RANK["commenter"],
    "write": ROLE_RANK["editor"],
}


async def role_for(db: AsyncSession, document_id: uuid.UUID, user: User) -> str | None:
    """The caller's role on a document, or None if they cannot see it."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        return None
    if doc.user_id == user.id:
        return OWNER_ROLE

    member = await db.execute(
        select(DocumentMember).where(
            DocumentMember.document_id == document_id,
            or_(
                DocumentMember.principal_id == user.id,
                DocumentMember.invited_email == user.email,
            ),
        )
    )
    row = member.scalar_one_or_none()
    return row.role if row else None


async def require(
    db: AsyncSession,
    document_id: uuid.UUID,
    user: User,
    capability: Capability,
) -> Document:
    """Fetch a document the caller may use for `capability`, or raise.

    A document the caller cannot see at all is reported as 404 rather than
    403: whether it exists is itself not their business.
    """
    role = await role_for(db, document_id, user)
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if capability == "manage":
        if role != OWNER_ROLE:
            raise HTTPException(
                status_code=403, detail="Only the owner can share or delete this document"
            )
    elif role != OWNER_ROLE and ROLE_RANK.get(role, -1) < _REQUIRED_RANK[capability]:
        raise HTTPException(
            status_code=403,
            detail=f"Your role on this document ({role}) does not allow this",
        )

    result = await db.execute(select(Document).where(Document.id == document_id))
    return result.scalar_one()


async def visible_document_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    """Documents shared *with* the caller — owned ones are queried separately."""
    result = await db.execute(
        select(DocumentMember.document_id).where(
            or_(
                DocumentMember.principal_id == user.id,
                DocumentMember.invited_email == user.email,
            )
        )
    )
    return list(result.scalars().all())


async def claim_pending_invitations(db: AsyncSession, user: User) -> int:
    """Bind invitations addressed to this email to the account that just appeared.

    Someone can be invited before they have ever signed in, so the row starts
    with only an email on it.
    """
    result = await db.execute(
        select(DocumentMember).where(
            DocumentMember.invited_email == user.email,
            DocumentMember.principal_id.is_(None),
        )
    )
    rows = list(result.scalars().all())
    for row in rows:
        row.principal_id = user.id
    if rows:
        await db.commit()
    return len(rows)
