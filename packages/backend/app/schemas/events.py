import json

from pydantic import BaseModel, Field, model_validator


class AnswerQuestionRequest(BaseModel):
    question: str = Field(max_length=1000)
    answer: str | None = Field(default=None, max_length=5000)  # None = skipped


class EventRequest(BaseModel):
    event_type: str = Field(max_length=50)  # 'approved_alignment' | 'section_action'
    data: dict

    @model_validator(mode="after")
    def _validate_data_size(self) -> "EventRequest":
        # Limit total payload to prevent abuse and runaway LLM context costs.
        # 200 KB accommodates the largest legitimate case: analyze_user_edit
        # which sends the full section content (~100 KB max) back for analysis.
        if len(json.dumps(self.data, separators=(",", ":"))) > 200_000:
            raise ValueError("data payload exceeds maximum allowed size (200 KB)")
        if self.event_type == "section_action":
            for field in ("prompt", "message"):
                value = self.data.get(field)
                if value is not None and len(str(value)) > 1000:
                    raise ValueError(f"'{field}' exceeds maximum length of 1000 characters")
        return self
