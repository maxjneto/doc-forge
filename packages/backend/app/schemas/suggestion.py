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


class FeedbackAnchor(BaseModel):
    """Where in the text a comment points: the passage, and the heading it sat under."""

    quote: str | None = Field(default=None, max_length=1000)
    heading: str | None = Field(default=None, max_length=300)


class FeedbackCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    section_id: UUID | None = None
    anchor: FeedbackAnchor | None = None
    # A request for the agent to act on (agents read these first).
    for_agent: bool = False


class FeedbackReplyRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class FeedbackUpdateRequest(BaseModel):
    """Reopen a resolved thread, or address it to (or take it away from) the agent."""

    status: Literal["open"] | None = None
    for_agent: bool | None = None


class FeedbackResolveRequest(BaseModel):
    resolution_note: str | None = Field(default=None, max_length=2000)
    status: Literal["addressed", "resolved"] = "resolved"


class FeedbackResponse(BaseModel):
    id: UUID
    document_id: UUID
    section_id: UUID | None
    suggestion_id: UUID | None
    parent_id: UUID | None = None
    anchor: dict | None = None
    for_agent: bool = False
    content: str
    status: str
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None
    # Who wrote it: a person by name, an agent by its key's name.
    author_name: str | None = None
    by_agent: bool = False
    harness: str | None = None
    is_mine: bool = False

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    feedback: list[FeedbackResponse]


class SectionWriteResponse(BaseModel):
    """Result of a section write: either applied directly or held as a suggestion."""

    mode: Literal["direct", "suggestion"]
    version_id: UUID | None = None
    suggestion_id: UUID | None = None
    content_length: int


class SuggestionTriageRequest(BaseModel):
    """Which numbered changes the reviewer kept.

    Indexes are 1-based and match what the browser showed as `CHANGE n OF m`.
    The server recomputes the hunks with the same algorithm rather than
    trusting a client-built result — see app/services/hunks.py.
    """

    accepted_indexes: list[int] = Field(default_factory=list)
    # Why the rest were turned down. Becomes agent-readable feedback.
    comment: str | None = Field(default=None, max_length=4000)
