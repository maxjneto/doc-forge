from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SuggestionCreateRequest(BaseModel):
    content: str = Field(max_length=200000)
    note: str | None = Field(default=None, max_length=2000)


class SuggestionRejectRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=4000)


class SuggestionResponse(BaseModel):
    id: UUID
    document_id: UUID
    section_id: UUID
    proposed_version_id: UUID
    base_version_id: UUID | None
    status: str
    note: str | None
    review_comment: str | None
    agent_name: str | None = None
    proposed_content: str | None = None
    current_content: str | None = None
    is_stale: bool = False
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class SuggestionListResponse(BaseModel):
    suggestions: list[SuggestionResponse]


class FeedbackCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    section_id: UUID | None = None


class FeedbackResolveRequest(BaseModel):
    resolution_note: str | None = Field(default=None, max_length=2000)
    status: Literal["addressed", "resolved"] = "resolved"


class FeedbackResponse(BaseModel):
    id: UUID
    document_id: UUID
    section_id: UUID | None
    suggestion_id: UUID | None
    content: str
    status: str
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    feedback: list[FeedbackResponse]


class SectionWriteResponse(BaseModel):
    """Result of a section write: either applied directly or held as a suggestion."""

    mode: Literal["direct", "suggestion"]
    version_id: UUID | None = None
    suggestion_id: UUID | None = None
    content_length: int
