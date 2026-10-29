from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ArtifactKind = Literal["diagram", "table", "decision"]


class ArtifactCreateRequest(BaseModel):
    # Referenced from the markdown as ::artefato[key]; slug-ish so it reads
    # well inline.
    key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*$")
    kind: ArtifactKind
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1)


class ArtifactUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    content: str | None = Field(default=None, min_length=1)
    kind: ArtifactKind | None = None


class ArtifactResponse(BaseModel):
    id: str
    document_id: str
    key: str
    kind: ArtifactKind
    title: str
    content: str
    author: str | None
    is_agent: bool
    revision: int
    # True when a ::artefato[key] directive for this key exists in the body.
    anchored: bool
    created_at: datetime
    updated_at: datetime


class ArtifactListResponse(BaseModel):
    artifacts: list[ArtifactResponse]
