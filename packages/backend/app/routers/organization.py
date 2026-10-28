"""Folders and sharing.

Two things that turn DocForge from a list of one user's documents into a place
documents live in. See docs/product/document-organization.md.
"""

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, DocumentMember, Folder, Section, SectionVersion
from app.models.organization import ROLES
from app.models.user import User
from app.services import access

router = APIRouter(tags=["organization"])


# ─── Folders ─────────────────────────────────────────────────


class FolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: uuid.UUID | None = None


class FolderUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: uuid.UUID | None = None


class FolderResponse(BaseModel):
    id: str
    name: str
    parent_id: str | None
    document_count: int
    direct_document_count: int = 0


class FolderListResponse(BaseModel):
    folders: list[FolderResponse]


async def _own_folder(folder_id: uuid.UUID, user: User, db: AsyncSession) -> Folder:
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


async def _would_cycle(db: AsyncSession, folder_id: uuid.UUID, new_parent: uuid.UUID) -> bool:
    """True if re-parenting would make a folder its own ancestor."""
    seen: set[uuid.UUID] = set()
    cursor: uuid.UUID | None = new_parent
    while cursor is not None:
        if cursor == folder_id:
            return True
        if cursor in seen:  # pre-existing cycle; refuse rather than loop
            return True
        seen.add(cursor)
        result = await db.execute(select(Folder.parent_id).where(Folder.id == cursor))
        cursor = result.scalar_one_or_none()
    return False


@router.get("/folders", response_model=FolderListResponse)
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.user_id == current_user.id).order_by(Folder.name)
    )
    folders = list(result.scalars().all())

    counts = await db.execute(
        select(Document.folder_id).where(Document.user_id == current_user.id)
    )
    direct_tally: dict[uuid.UUID, int] = {}
    for folder_id in counts.scalars().all():
        if folder_id:
            direct_tally[folder_id] = direct_tally.get(folder_id, 0) + 1

    children: dict[uuid.UUID, list[uuid.UUID]] = {}
    for folder in folders:
        if folder.parent_id:
            children.setdefault(folder.parent_id, []).append(folder.id)

    def recursive_count(folder_id: uuid.UUID, seen: set[uuid.UUID] | None = None) -> int:
        trail = set() if seen is None else seen
        if folder_id in trail:
            return direct_tally.get(folder_id, 0)
        trail.add(folder_id)
        return direct_tally.get(folder_id, 0) + sum(
            recursive_count(child_id, trail.copy()) for child_id in children.get(folder_id, [])
        )

    return FolderListResponse(
        folders=[
            FolderResponse(
                id=str(f.id),
                name=f.name,
                parent_id=str(f.parent_id) if f.parent_id else None,
                document_count=recursive_count(f.id),
                direct_document_count=direct_tally.get(f.id, 0),
            )
            for f in folders
        ]
    )


@router.post("/folders", response_model=FolderResponse, status_code=201)
async def create_folder(
    payload: FolderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.parent_id:
        await _own_folder(payload.parent_id, current_user, db)
    folder = Folder(user_id=current_user.id, name=payload.name, parent_id=payload.parent_id)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return FolderResponse(
        id=str(folder.id),
        name=folder.name,
        parent_id=str(folder.parent_id) if folder.parent_id else None,
        document_count=0,
        direct_document_count=0,
    )


@router.patch("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    payload: FolderUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = await _own_folder(folder_id, current_user, db)
    if payload.name is not None:
        folder.name = payload.name
    if "parent_id" in payload.model_fields_set:
        if payload.parent_id is not None:
            await _own_folder(payload.parent_id, current_user, db)
            if await _would_cycle(db, folder_id, payload.parent_id):
                raise HTTPException(status_code=409, detail="A folder cannot contain itself")
        folder.parent_id = payload.parent_id
    await db.commit()
    await db.refresh(folder)
    return FolderResponse(
        id=str(folder.id),
        name=folder.name,
        parent_id=str(folder.parent_id) if folder.parent_id else None,
        document_count=0,
        direct_document_count=0,
    )


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a folder. Documents inside are kept and fall back to the root —
    deleting a shelf should never delete the books."""
    folder = await _own_folder(folder_id, current_user, db)
    docs = await db.execute(select(Document).where(Document.folder_id == folder_id))
    for doc in docs.scalars().all():
        doc.folder_id = None
    await db.delete(folder)
    await db.commit()


class MoveDocumentRequest(BaseModel):
    folder_id: uuid.UUID | None = None


@router.patch("/documents/{document_id}/folder", status_code=204)
async def move_document(
    document_id: uuid.UUID,
    payload: MoveDocumentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await access.require(db, document_id, current_user, "manage")
    if payload.folder_id:
        await _own_folder(payload.folder_id, current_user, db)
    doc.folder_id = payload.folder_id
    await db.commit()


# ─── Sharing ─────────────────────────────────────────────────


class ShareRequest(BaseModel):
    # Plain str rather than EmailStr: pulling in `email-validator` for one
    # field is not worth it, and the address only has to route an invitation.
    email: str = Field(min_length=3, max_length=320)
    role: str = Field(default="viewer")

    @field_validator("email")
    @classmethod
    def _looks_like_an_address(cls, v: str) -> str:
        v = v.strip().lower()
        local, _, domain = v.partition("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("not a valid email address")
        return v


class MemberResponse(BaseModel):
    id: str
    email: str
    role: str
    # False while the invitation is addressed to someone with no account yet.
    accepted: bool


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    my_role: str


@router.get("/documents/{document_id}/members", response_model=MemberListResponse)
async def list_members(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await access.require(db, document_id, current_user, "read")
    role = await access.role_for(db, document_id, current_user)
    result = await db.execute(
        select(DocumentMember).where(DocumentMember.document_id == document_id)
    )
    return MemberListResponse(
        members=[
            MemberResponse(
                id=str(m.id),
                email=m.invited_email,
                role=m.role,
                accepted=m.principal_id is not None,
            )
            for m in result.scalars().all()
        ],
        my_role=role or "viewer",
    )


@router.post("/documents/{document_id}/members", response_model=MemberResponse, status_code=201)
async def share_document(
    document_id: uuid.UUID,
    payload: ShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite someone by email. They may not have an account yet — the row
    carries the address until they sign in and claim it."""
    doc = await access.require(db, document_id, current_user, "manage")
    if payload.role not in ROLES:
        raise HTTPException(status_code=422, detail=f"role must be one of {list(ROLES)}")
    if payload.email == (current_user.email or "").lower():
        raise HTTPException(status_code=409, detail="You already own this document")

    existing = await db.execute(
        select(DocumentMember).where(
            DocumentMember.document_id == document_id,
            DocumentMember.invited_email == payload.email,
        )
    )
    member = existing.scalar_one_or_none()
    if member:
        member.role = payload.role
    else:
        invitee = await db.execute(select(User).where(User.email == payload.email))
        account = invitee.scalar_one_or_none()
        member = DocumentMember(
            document_id=doc.id,
            invited_email=payload.email,
            principal_id=account.id if account else None,
            role=payload.role,
            invited_by=current_user.id,
        )
        db.add(member)
    await db.commit()
    await db.refresh(member)
    return MemberResponse(
        id=str(member.id),
        email=member.invited_email,
        role=member.role,
        accepted=member.principal_id is not None,
    )


@router.delete("/documents/{document_id}/members/{member_id}", status_code=204)
async def unshare_document(
    document_id: uuid.UUID,
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await access.require(db, document_id, current_user, "manage")
    result = await db.execute(
        select(DocumentMember).where(
            DocumentMember.id == member_id, DocumentMember.document_id == document_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()


# Deliberately not /documents/shared-with-me: the documents router declares
# /documents/{document_id} first, so a literal segment there would be swallowed
# by the UUID path parameter.
@router.get("/shared-documents")
async def shared_with_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Documents other people gave this account access to."""
    await access.claim_pending_invitations(db, current_user)
    result = await db.execute(
        select(Document, DocumentMember.role)
        .join(DocumentMember, DocumentMember.document_id == Document.id)
        .where(
            or_(
                DocumentMember.principal_id == current_user.id,
                DocumentMember.invited_email == current_user.email,
            )
        )
        .order_by(Document.updated_at.desc())
    )
    return {
        "documents": [
            {
                "id": str(doc.id),
                "title": doc.title,
                "document_mode": doc.document_mode,
                "role": role,
                "created_at": doc.created_at,
                "updated_at": doc.updated_at,
            }
            for doc, role in result.all()
        ]
    }


# ─── Public link ─────────────────────────────────────────────


class PublicLinkResponse(BaseModel):
    # Null when the document is not publicly readable.
    token: str | None
    enabled: bool


@router.post("/documents/{document_id}/public-link", response_model=PublicLinkResponse)
async def set_public_link(
    document_id: uuid.UUID,
    enabled: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Turn the read-only public link on or off.

    Turning it off clears the token, so any link already shared stops working
    — revocation has to be real, not cosmetic.
    """
    doc = await access.require(db, document_id, current_user, "manage")
    doc.public_token = secrets.token_urlsafe(24) if enabled else None
    await db.commit()
    return PublicLinkResponse(token=doc.public_token, enabled=bool(doc.public_token))


@router.get("/documents/{document_id}/public-link", response_model=PublicLinkResponse)
async def get_public_link(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the existing capability link without rotating its token."""
    doc = await access.require(db, document_id, current_user, "manage")
    return PublicLinkResponse(token=doc.public_token, enabled=bool(doc.public_token))


@router.get("/public/{token}")
async def read_public_document(token: str, db: AsyncSession = Depends(get_db)):
    """Read a document by its public token. No authentication: the token *is*
    the capability. Returns only what a reader needs — never the members,
    versions, suggestions or gate."""
    result = await db.execute(select(Document).where(Document.public_token == token))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    if doc.document_mode == "layout":
        # Only what was published (a snapshot); the reader page draws it with the library.
        from app.routers.layout import published_layout

        found = await published_layout(db, token)
        if found is None:
            raise HTTPException(status_code=404, detail="No published version")
        _, layout = found
        return {
            "title": doc.title,
            "mode": "layout",
            "content": layout.published_content,
            "revision": layout.published_revision,
            "updated_at": layout.published_at,
        }

    body = await db.execute(
        select(SectionVersion.content, SectionVersion.published_at)
        .join(Section, Section.id == SectionVersion.section_id)
        .where(
            Section.document_id == doc.id,
            Section.section_type == "body",
            SectionVersion.is_published.is_(True),
        )
    )
    published = body.one_or_none()
    if published is None:
        raise HTTPException(status_code=404, detail="No published version")
    return {
        "title": doc.title,
        "mode": "markdown",
        "content": published.content,
        "updated_at": published.published_at,
    }
