from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditFindingResponse(BaseModel):
    id: UUID
    document_id: UUID
    section_type: str
    description: str
    severity: str
    dismissed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
