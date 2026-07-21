from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user, get_current_user_optional
from app.database import get_db
from app.models.document_type import DocumentType, SectionDefinition
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.schemas.document_type import (
    DocumentTypeCreateRequest,
    DocumentTypeResponse,
    PromptTemplateResponse,
    PromptUpsertRequest,
)

router = APIRouter(tags=["document-types"])


def _to_response(dt: DocumentType) -> DocumentTypeResponse:
    return DocumentTypeResponse(
        id=dt.id,
        slug=dt.slug,
        name=dt.name,
        description=dt.description,
        is_active=dt.is_active,
        is_custom=dt.user_id is not None,
        sections=dt.section_definitions,
    )


def _require_customization(user: User) -> None:
    if (user.plan or "free") == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Custom document types are a Pro feature.",
        )


@router.get("/document-types", response_model=list[DocumentTypeResponse])
async def list_document_types(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Global (seeded) types for everyone; plus the caller's custom types when authenticated."""
    visibility = DocumentType.user_id.is_(None)
    if current_user is not None:
        visibility = or_(visibility, DocumentType.user_id == current_user.id)
    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.is_active.is_(True), visibility)
        .order_by(DocumentType.created_at)
    )
    return [_to_response(dt) for dt in result.scalars().all()]


@router.get("/document-types/{slug}", response_model=DocumentTypeResponse)
async def get_document_type(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    visibility = DocumentType.user_id.is_(None)
    if current_user is not None:
        visibility = or_(visibility, DocumentType.user_id == current_user.id)
    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.slug == slug, DocumentType.is_active.is_(True), visibility)
    )
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    return _to_response(dt)


@router.post("/document-types", response_model=DocumentTypeResponse, status_code=201)
async def create_document_type(
    payload: DocumentTypeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a user-owned custom document type (P3 completa — Pro feature)."""
    _require_customization(current_user)

    existing = await db.execute(
        select(DocumentType).where(DocumentType.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{payload.slug}' is already taken.")

    orders = [s.order for s in payload.sections]
    if len(set(orders)) != len(orders):
        raise HTTPException(status_code=422, detail="Section orders must be unique.")
    keys = [s.section_key for s in payload.sections]
    if len(set(keys)) != len(keys):
        raise HTTPException(status_code=422, detail="Section keys must be unique.")

    dt = DocumentType(
        slug=payload.slug,
        name=payload.name,
        description=payload.description,
        is_active=True,
        user_id=current_user.id,
    )
    db.add(dt)
    await db.flush()
    for s in payload.sections:
        db.add(SectionDefinition(
            document_type_id=dt.id,
            section_key=s.section_key,
            display_name=s.display_name,
            order=s.order,
            role_description=s.role_description,
        ))
    await db.commit()

    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.id == dt.id)
    )
    return _to_response(result.scalar_one())


@router.put("/document-types/{slug}/prompts", response_model=PromptTemplateResponse)
async def upsert_prompt(
    slug: str,
    payload: PromptUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a prompt template on a custom type you own.

    These prompts are the single source for both pipeline step instructions
    and (future) server-side execution — customized once, used everywhere.
    """
    _require_customization(current_user)
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.slug == slug, DocumentType.user_id == current_user.id
        )
    )
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Custom document type not found")

    tmpl_result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.document_type_id == dt.id,
            PromptTemplate.phase == payload.phase,
            PromptTemplate.section_key == payload.section_key
            if payload.section_key is not None
            else PromptTemplate.section_key.is_(None),
        )
    )
    tmpl = tmpl_result.scalar_one_or_none()
    if tmpl:
        tmpl.prompt_text = payload.prompt_text
    else:
        tmpl = PromptTemplate(
            document_type_id=dt.id,
            phase=payload.phase,
            section_key=payload.section_key,
            prompt_text=payload.prompt_text,
        )
        db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return PromptTemplateResponse.model_validate(tmpl)
