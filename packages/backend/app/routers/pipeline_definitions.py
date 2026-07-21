import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import PipelineDefinition
from app.models.document_type import DocumentType
from app.models.user import User
from app.services import pipeline as pipeline_service
from app.services.pipeline import PipelineError

router = APIRouter(tags=["pipeline-definitions"])


class PipelineDefinitionResponse(BaseModel):
    id: uuid.UUID
    name: str
    base_document_type_id: uuid.UUID | None
    steps: list
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CloneRequest(BaseModel):
    document_type_slug: str = Field(default="rfc", max_length=50)
    name: str | None = Field(default=None, max_length=100)


class DefinitionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    steps: list | None = None


def _require_customization(user: User) -> None:
    if (user.plan or "free") == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Custom pipelines are a Pro feature.",
        )


async def _get_owned_definition(
    definition_id: uuid.UUID, current_user: User, db: AsyncSession
) -> PipelineDefinition:
    result = await db.execute(
        select(PipelineDefinition).where(
            PipelineDefinition.id == definition_id,
            PipelineDefinition.user_id == current_user.id,
        )
    )
    definition = result.scalar_one_or_none()
    if not definition:
        raise HTTPException(status_code=404, detail="Pipeline definition not found")
    return definition


@router.get("/pipeline-definitions", response_model=list[PipelineDefinitionResponse])
async def list_definitions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PipelineDefinition)
        .where(PipelineDefinition.user_id == current_user.id)
        .order_by(PipelineDefinition.created_at.desc())
    )
    return [PipelineDefinitionResponse.model_validate(d) for d in result.scalars().all()]


@router.post("/pipeline-definitions/clone", response_model=PipelineDefinitionResponse, status_code=201)
async def clone_baseline(
    payload: CloneRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clone the baseline pipeline of a document type into an editable definition.

    Prompts are materialized as real text so 'customize the pipeline' means
    editing the actual step prompts — no visual editor needed in v1.
    """
    _require_customization(current_user)
    dt_result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.slug == payload.document_type_slug, DocumentType.is_active.is_(True))
    )
    doc_type = dt_result.scalar_one_or_none()
    if not doc_type:
        raise HTTPException(
            status_code=400, detail=f"Unknown document type: {payload.document_type_slug}"
        )
    definition = await pipeline_service.clone_baseline_definition(
        db, current_user.id, doc_type, payload.name
    )
    return PipelineDefinitionResponse.model_validate(definition)


@router.get("/pipeline-definitions/{definition_id}", response_model=PipelineDefinitionResponse)
async def get_definition(
    definition_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    definition = await _get_owned_definition(definition_id, current_user, db)
    return PipelineDefinitionResponse.model_validate(definition)


@router.patch("/pipeline-definitions/{definition_id}", response_model=PipelineDefinitionResponse)
async def update_definition(
    definition_id: uuid.UUID,
    payload: DefinitionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_customization(current_user)
    definition = await _get_owned_definition(definition_id, current_user, db)

    if payload.steps is not None:
        section_keys: list[str] = []
        if definition.base_document_type_id is not None:
            dt_result = await db.execute(
                select(DocumentType)
                .options(selectinload(DocumentType.section_definitions))
                .where(DocumentType.id == definition.base_document_type_id)
            )
            doc_type = dt_result.scalar_one_or_none()
            if doc_type:
                section_keys = [
                    sd.section_key
                    for sd in sorted(doc_type.section_definitions, key=lambda s: s.order)
                ]
        try:
            pipeline_service.validate_definition_steps(payload.steps, section_keys)
        except PipelineError as e:
            raise HTTPException(status_code=422, detail=str(e))
        definition.steps = payload.steps

    if payload.name is not None:
        definition.name = payload.name

    await db.commit()
    await db.refresh(definition)
    return PipelineDefinitionResponse.model_validate(definition)


@router.delete("/pipeline-definitions/{definition_id}", status_code=204)
async def delete_definition(
    definition_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    definition = await _get_owned_definition(definition_id, current_user, db)
    await db.delete(definition)
    await db.commit()
