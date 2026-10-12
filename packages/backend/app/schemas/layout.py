import datetime
from typing import Any

from pydantic import BaseModel, Field


class LayoutDocumentCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    # A full @docforge/layout document. Omitted = an empty starter document.
    content: dict[str, Any] | None = None


class LayoutOpsRequest(BaseModel):
    ops: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    # The revision the caller based its operations on. When set and stale, the
    # write is refused with 409 instead of silently building on newer content.
    base_revision: int | None = None


class LayoutReplaceRequest(BaseModel):
    content: dict[str, Any]
    base_revision: int | None = None


class LayoutStateResponse(BaseModel):
    document_id: str
    content: dict[str, Any]
    revision: int
    updated_at: datetime.datetime | None = None


class LayoutWriteResponse(BaseModel):
    document_id: str
    # True when the write was accepted and saved. False = nothing changed;
    # `diagnostics` says why.
    ok: bool
    revision: int
    diagnostics: list[dict[str, Any]]
    # Level-1 grid map of the saved document (or of the rejected attempt).
    map: str


class LayoutMapResponse(BaseModel):
    document_id: str
    revision: int
    level: int
    text: str
