from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SectionVersionResponse(BaseModel):
    id: UUID
    section_id: UUID
    parent_version_id: UUID | None
    version_name: str
    change_summary: str | None
    content: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SectionVersionUpdateRequest(BaseModel):
    change_summary: str | None = None
    version_name: str | None = None


class SectionContentUpdateRequest(BaseModel):
    content: str
    note: str | None = None


class SectionSnapshotRequest(BaseModel):
    version_name: str | None = None
    change_summary: str | None = None


class SectionResponse(BaseModel):
    id: UUID
    document_id: UUID
    section_type: str
    status: str
    summary: str | None
    versions: list[SectionVersionResponse]

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: UUID
    document_id: UUID
    section_id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionRestoreResponse(BaseModel):
    success: bool
    active_version_id: UUID
