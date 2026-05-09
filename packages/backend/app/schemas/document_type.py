from uuid import UUID

from pydantic import BaseModel


class SectionDefinitionResponse(BaseModel):
    id: UUID
    section_key: str
    display_name: str
    order: int
    role_description: str

    model_config = {"from_attributes": True}


class DocumentTypeResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    is_active: bool
    sections: list[SectionDefinitionResponse] = []

    model_config = {"from_attributes": True}
