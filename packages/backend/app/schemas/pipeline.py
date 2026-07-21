from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PipelineStartRequest(BaseModel):
    document_type_slug: str = Field(default="rfc", max_length=50)
    title: str | None = Field(default=None, max_length=200)
    document_context: str = Field(min_length=20, max_length=20000)
    # Optional: run a custom PipelineDefinition instead of the baseline.
    # When set, the definition's base document type wins over document_type_slug.
    pipeline_definition_id: UUID | None = None


class PipelineSubmitRequest(BaseModel):
    payload: dict


class PipelineRunResponse(BaseModel):
    id: UUID
    document_id: UUID
    definition_slug: str
    steps: list
    current_step_index: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineStartResponse(BaseModel):
    document_id: UUID
    title: str
    run: PipelineRunResponse
    next_step: dict
