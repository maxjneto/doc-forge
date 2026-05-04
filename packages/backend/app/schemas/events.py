from pydantic import BaseModel


class AnswerQuestionRequest(BaseModel):
    question: str
    answer: str | None = None  # None = skipped


class EventRequest(BaseModel):
    event_type: str  # 'approved_alignment' | 'section_action'
    data: dict
