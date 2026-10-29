"""Artifacts — the supporting material around a document's text.

Diagrams, tables and decision notes that explain *why* the text says what it
says. Agents used to produce this in the terminal, where it was lost, because
DocForge only accepted document content.

Anchoring is explicit: the body carries a `::artefato[key]` directive. That
means the anchor lives in the markdown (survives export, never drifts) and
`anchored` is derived by scanning the body rather than stored.
"""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Artifact, Document, Section, SectionVersion
from app.models.api_key import ApiKey
from app.models.user import User
from app.schemas.artifact import (
    ArtifactCreateRequest,
    ArtifactListResponse,
    ArtifactResponse,
    ArtifactUpdateRequest,
)
from app.services import access
from app.services import db as db_service

router = APIRouter(tags=["artifacts"])

DIRECTIVE_RE = re.compile(r"::artefato\[([a-z0-9][a-z0-9-]*)\]")


def directive_for(key: str) -> str:
    """The line an agent inserts into the body to anchor an artifact."""
    return f"::artefato[{key}]"


def anchored_keys(body: str) -> set[str]:
    """Keys the document currently points at."""
    return set(DIRECTIVE_RE.findall(body or ""))


async def _document(
    document_id: uuid.UUID, user: User, db: AsyncSession, capability: access.Capability = "write"
) -> Document:
    return await access.require(db, document_id, user, capability)


async def _body_text(document_id: uuid.UUID, db: AsyncSession) -> str:
    """Active content of the document's body section, if it has one."""
    result = await db.execute(
        select(SectionVersion.content)
        .join(Section, Section.id == SectionVersion.section_id)
        .where(
            Section.document_id == document_id,
            Section.section_type == "body",
            SectionVersion.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none() or ""


async def _to_response(artifact: Artifact, body: str, db: AsyncSession) -> ArtifactResponse:
    author: str | None = None
    is_agent = False
    if artifact.api_key_id:
        result = await db.execute(select(ApiKey.name).where(ApiKey.id == artifact.api_key_id))
        author = result.scalar_one_or_none()
        is_agent = True
    elif artifact.author_user_id:
        result = await db.execute(select(User.name).where(User.id == artifact.author_user_id))
        author = result.scalar_one_or_none()

    return ArtifactResponse(
        id=str(artifact.id),
        document_id=str(artifact.document_id),
        key=artifact.key,
        kind=artifact.kind,  # type: ignore[arg-type]
        title=artifact.title,
        content=artifact.content,
        author=author,
        is_agent=is_agent,
        revision=artifact.revision,
        anchored=artifact.key in anchored_keys(body),
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
    )


@router.get("/documents/{document_id}/artifacts", response_model=ArtifactListResponse)
async def list_artifacts(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _document(document_id, current_user, db, "read")
    body = await _body_text(document_id, db)
    result = await db.execute(
        select(Artifact)
        .where(Artifact.document_id == document_id)
        .order_by(Artifact.created_at.asc())
    )
    return ArtifactListResponse(
        artifacts=[await _to_response(a, body, db) for a in result.scalars().all()]
    )


@router.post("/documents/{document_id}/artifacts", response_model=ArtifactResponse, status_code=201)
async def create_artifact(
    document_id: uuid.UUID,
    payload: ArtifactCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _document(document_id, current_user, db)
    api_key_id = getattr(request.state, "api_key_id", None)

    existing = await db.execute(
        select(Artifact).where(Artifact.document_id == document_id, Artifact.key == payload.key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"An artifact with key '{payload.key}' already exists in this document",
        )

    artifact = Artifact(
        document_id=document_id,
        key=payload.key,
        kind=payload.kind,
        title=payload.title,
        content=payload.content,
        author_user_id=None if api_key_id else current_user.id,
        api_key_id=api_key_id,
    )
    db.add(artifact)
    await db.flush()

    await db_service.log_activity(
        db,
        document_id,
        "artifact_created",
        description=f"{payload.kind} artifact '{payload.title}' added",
        api_key_id=api_key_id,
    )
    await db.commit()
    await db.refresh(artifact)

    body = await _body_text(document_id, db)
    return await _to_response(artifact, body, db)


@router.patch("/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(
    artifact_id: uuid.UUID,
    payload: ArtifactUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    await _document(artifact.document_id, current_user, db)

    changed = False
    for field in ("title", "content", "kind"):
        value = getattr(payload, field)
        if value is not None and value != getattr(artifact, field):
            setattr(artifact, field, value)
            changed = True
    if changed:
        artifact.revision += 1
    await db.commit()
    await db.refresh(artifact)

    body = await _body_text(artifact.document_id, db)
    return await _to_response(artifact, body, db)


@router.delete("/artifacts/{artifact_id}", status_code=204)
async def delete_artifact(
    artifact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    await _document(artifact.document_id, current_user, db)
    await db.delete(artifact)
    await db.commit()
