from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    agent_write_policy: Literal["suggest", "direct"] | None = None
    require_gate_on_accept: bool | None = None


class DocumentCreate(BaseModel):
    """A Markdown document; layout documents are created through /layout-documents."""

    title: str | None = Field(default=None, max_length=200)


class SectionBriefResponse(BaseModel):
    id: UUID
    section_type: str
    active_version_content: str | None = None

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: UUID
    title: str
    document_mode: str = "editor"
    agent_write_policy: str = "suggest"
    require_gate_on_accept: bool = False
    created_at: datetime
    updated_at: datetime
    has_api_key_activity: bool = False
    # Folder it is filed under, null at the root.
    folder_id: UUID | None = None
    last_api_key_name: str | None = None
    published_version_id: UUID | None = None
    published_at: datetime | None = None
    has_unpublished_changes: bool = False
    archived_at: datetime | None = None

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class DocumentDetailResponse(BaseModel):
    document: DocumentResponse
    sections: list[SectionBriefResponse]
