from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    title: str
    document_context: str
    user_preferences: str | None = None


class CompletedSectionUpdate(BaseModel):
    section_type: str
    content: str


class CompletedDocumentUpdateRequest(BaseModel):
    sections: list[CompletedSectionUpdate]


class DiscoveryQuestionResponse(BaseModel):
    id: UUID
    question: str
    answer: str | None
    skipped: bool
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
