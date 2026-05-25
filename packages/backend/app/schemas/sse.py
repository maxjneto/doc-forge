import datetime
from typing import Literal

from pydantic import BaseModel, Field

SSEEventType = Literal[
    "phase_changed",
    "section_updated",
    "audit_results",
    "document_updated",
    "error",
]


class SSEEvent(BaseModel):
    type: SSEEventType
    payload: dict
    timestamp: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )
