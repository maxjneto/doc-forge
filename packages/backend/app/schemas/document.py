from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    title: str = Field(max_length=200)
    document_context: str = Field(max_length=20000)
    user_preferences: str | None = Field(default=None, max_length=2000)
    document_type_slug: str = Field(default="rfc", max_length=50)


class CompletedSectionUpdate(BaseModel):
    section_type: str = Field(max_length=50)
    content: str = Field(max_length=100000)


class CompletedDocumentUpdateRequest(BaseModel):
    sections: list[CompletedSectionUpdate]


class DiscoveryQuestionResponse(BaseModel):
    id: UUID
    question: str
    answer: str | None
    skipped: bool
    section_key: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SectionBriefResponse(BaseModel):
    id: UUID
    section_type: str
    status: str
    summary: str | None
    active_version_content: str | None = None

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: UUID
    title: str
    current_phase: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class DocumentDetailResponse(BaseModel):
    document: DocumentResponse
    sections: list[SectionBriefResponse]
    discovery_questions: list[DiscoveryQuestionResponse]
    audit_problems: list[dict] | None = None
