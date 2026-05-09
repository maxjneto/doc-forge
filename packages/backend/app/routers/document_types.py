from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document_type import DocumentType
from app.schemas.document_type import DocumentTypeResponse

router = APIRouter(tags=["document-types"])


@router.get("/document-types", response_model=list[DocumentTypeResponse])
async def list_document_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.is_active.is_(True))
        .order_by(DocumentType.created_at)
    )
    doc_types = result.scalars().all()
    return [
        DocumentTypeResponse(
            id=dt.id,
            slug=dt.slug,
            name=dt.name,
            description=dt.description,
            is_active=dt.is_active,
            sections=dt.section_definitions,
        )
        for dt in doc_types
    ]


@router.get("/document-types/{slug}", response_model=DocumentTypeResponse)
async def get_document_type(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.slug == slug, DocumentType.is_active.is_(True))
    )
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    return DocumentTypeResponse(
        id=dt.id,
        slug=dt.slug,
        name=dt.name,
        description=dt.description,
        is_active=dt.is_active,
        sections=dt.section_definitions,
    )
