from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    harness: str | None = None


class ApiKeyCreateResponse(BaseModel):
    id: UUID
    name: str
    harness: str | None
    key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyUpdateRequest(BaseModel):
    harness: str | None = None


class ApiKeyListItem(BaseModel):
    id: UUID
    name: str
    harness: str | None
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None

    model_config = {"from_attributes": True}
