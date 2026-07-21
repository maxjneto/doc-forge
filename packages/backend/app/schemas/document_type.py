from uuid import UUID

from pydantic import BaseModel, Field


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
    is_custom: bool = False
    sections: list[SectionDefinitionResponse] = []

    model_config = {"from_attributes": True}


class SectionDefinitionCreate(BaseModel):
    section_key: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_-]+$")
    display_name: str = Field(min_length=1, max_length=100)
    order: int = Field(ge=1, le=50)
    role_description: str = Field(min_length=1, max_length=2000)


class DocumentTypeCreateRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=2000)
    sections: list[SectionDefinitionCreate] = Field(min_length=1, max_length=12)


class PromptUpsertRequest(BaseModel):
    phase: str = Field(pattern=r"^(discovery|alignment|generation|refinement|audit|coherence)$")
    section_key: str | None = Field(default=None, max_length=50)
    prompt_text: str = Field(min_length=1, max_length=20000)


class PromptTemplateResponse(BaseModel):
    id: UUID
    document_type_id: UUID
    phase: str
    section_key: str | None
    prompt_text: str

    model_config = {"from_attributes": True}
