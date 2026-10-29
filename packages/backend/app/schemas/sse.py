import datetime
from typing import Literal

from pydantic import BaseModel, Field

SSEEventType = Literal[
    "section_updated",
    "audit_results",
    "document_updated",
    "suggestion_created",
    "suggestion_resolved",
    "feedback_created",
    "feedback_resolved",
    "layout_note_changed",
    "layout_version_saved",
]


class SSEEvent(BaseModel):
    type: SSEEventType
    payload: dict
    timestamp: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )
