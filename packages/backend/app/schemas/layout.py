import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class LayoutDocumentCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    # A full @docforge/layout document. Omitted = an empty starter document.
    content: dict[str, Any] | None = None
    # Start from a curated template instead (see GET /layout-templates). Not with `content`.
    template: Literal["relatorio", "proposta", "one-pager", "apresentacao"] | None = None
    # An empty document's format: "page" (A4, the default) or "slide" (16:9, a deck). Only without content/template.
    format: Literal["page", "slide"] | None = None

    @model_validator(mode="after")
    def _one_source(self):
        if self.content is not None and self.template is not None:
            raise ValueError("Give content or template, not both.")
        if self.format is not None and (self.content is not None or self.template is not None):
            raise ValueError("`format` is only for an empty document.")
        return self


class LayoutOpsRequest(BaseModel):
    ops: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    # The revision the caller based its operations on. When set and stale, the
    # write is refused with 409 instead of silently building on newer content.
    base_revision: int | None = None
    # Map of the result: only these pages (1-based), and/or without the drawing.
    pages: list[int] | None = None
    draw: bool | None = None
    # Why, in a sentence, for the person reviewing the change (kept with the revision).
    note: str | None = Field(default=None, max_length=500)


class LayoutReplaceRequest(BaseModel):
    content: dict[str, Any]
    base_revision: int | None = None


class LayoutPreviewRequest(BaseModel):
    """A document that is not stored: optionally with operations to apply to it."""

    content: dict[str, Any]
    ops: list[dict[str, Any]] | None = Field(default=None, max_length=200)
    pages: list[int] | None = None
    draw: bool | None = None


class LayoutMeasureRequest(BaseModel):
    component: dict[str, Any]
    # Measure with the styles of a stored document, or of a document sent inline.
    document_id: str | None = None
    content: dict[str, Any] | None = None
    widths: list[int] | None = Field(default=None, max_length=20)
    cols: list[list[int]] | None = Field(default=None, max_length=20)


class LayoutCalibrateRequest(BaseModel):
    """Exactly one target: a component id, a class (label) or a selector (`text`, `text.title-1`)."""

    component: str | None = Field(default=None, max_length=200)
    label: str | None = Field(default=None, max_length=200)
    selector: str | None = Field(default=None, max_length=200)
    variants: list[dict[str, Any]] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def _one_target(self):
        if sum(v is not None for v in (self.component, self.label, self.selector)) != 1:
            raise ValueError("Give exactly one of component, label or selector.")
        return self


class LayoutCalibrateResponse(BaseModel):
    document_id: str
    revision: int
    ok: bool
    variants: list[dict[str, Any]]
    text: str


class LayoutStateResponse(BaseModel):
    document_id: str
    content: dict[str, Any]
    revision: int
    updated_at: datetime.datetime | None = None
    title: str | None = None
    # What converting to an older format (`?format=`) could not keep; empty otherwise.
    notes: list[str] = []


class LayoutPublishRequest(BaseModel):
    # The revision to publish; default: the current one.
    revision: int | None = Field(default=None, ge=1)


class LayoutPublishState(BaseModel):
    document_id: str
    published: bool
    # The capability in the public link (…/public/<token>); null when not published.
    token: str | None = None
    revision: int | None = None
    published_at: datetime.datetime | None = None
    # The document's revision now: more than `revision` = edits not published yet.
    current_revision: int


class LayoutWriteResponse(BaseModel):
    document_id: str
    # True when the write was accepted and saved. False = nothing changed;
    # `diagnostics` says why (a malformed op, an unknown id, an invalid document).
    ok: bool
    revision: int
    diagnostics: list[dict[str, Any]]
    # What the layout did on its own to components the write did not touch.
    # Each one is also stored as a notice (see /layout/notes).
    changes: list[dict[str, Any]] = []
    # Level-1 map of the saved document (or of the rejected attempt).
    map: str
    # A few lines on what the write did (what the ops changed, what moved on its
    # own, problems, free rows per page). Empty when the service sent none.
    summary: str = ""


class LayoutPreviewResponse(BaseModel):
    # What a write would do; nothing was saved.
    ok: bool
    # The stored revision the preview started from (null for an inline document).
    base_revision: int | None = None
    diagnostics: list[dict[str, Any]]
    changes: list[dict[str, Any]] = []
    map: str
    summary: str = ""
    content: dict[str, Any] | None = None


class LayoutMapResponse(BaseModel):
    document_id: str
    revision: int
    level: int
    text: str
    open_notices: int = 0
    open_annotations: int = 0


class LayoutImageResponse(BaseModel):
    document_id: str
    revision: int
    page: int
    pages: int
    # PNG, base64-encoded.
    png: str
    width: int
    height: int


class LayoutReviewResponse(BaseModel):
    document_id: str
    revision: int
    # Each finding: code, severity, components, page?, message, fixes (ops), fixLabel?, data.
    findings: list[dict[str, Any]]
    text: str


class LayoutFindResponse(BaseModel):
    document_id: str
    revision: int
    matches: list[dict[str, Any]]
    text: str


class LayoutMeasureResponse(BaseModel):
    ok: bool
    measurements: list[dict[str, Any]]
    diagnostics: list[dict[str, Any]]
    text: str


class LayoutRect(BaseModel):
    page: int | None = Field(default=None, ge=1)
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    w: int = Field(ge=1)
    h: int = Field(ge=1)


class LayoutAnchor(BaseModel):
    component: str | None = Field(default=None, max_length=200)
    rect: LayoutRect | None = None

    @model_validator(mode="after")
    def _has_target(self):
        if self.component is None and self.rect is None:
            raise ValueError("An anchor needs a component, a rect, or both.")
        return self


class LayoutReviewQuestion(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    options: list[str] = Field(default_factory=list, max_length=6)


class LayoutReviewData(BaseModel):
    # Components the person should look at first.
    focus: list[str] = Field(default_factory=list, max_length=20)
    questions: list[LayoutReviewQuestion] = Field(default_factory=list, max_length=5)


class LayoutNoteCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    # Required for annotations; a review request may point at nothing in particular.
    anchor: LayoutAnchor | None = None
    # "review-request": an agent asks the person to look (message = summary).
    # "review-answer": the person's answers to a request.
    code: Literal["review-request", "review-answer"] | None = None
    review: LayoutReviewData | None = None
    # For a review answer: the request it answers and the chosen options.
    answers: dict[str, str] | None = None
    request_id: str | None = None
    # A reply in the thread of this note (it takes the root's anchor).
    parent_id: str | None = None
    # A request for the agent to act on (roots only).
    for_agent: bool = False

    @model_validator(mode="after")
    def _anchored(self):
        if self.code is None and self.anchor is None and self.parent_id is None:
            raise ValueError("An annotation needs an anchor.")
        return self


class LayoutNoteUpdate(BaseModel):
    status: Literal["open", "acknowledged", "resolved"] | None = None
    resolution_note: str | None = Field(default=None, max_length=2000)
    for_agent: bool | None = None

    @model_validator(mode="after")
    def _something(self):
        if self.status is None and self.for_agent is None:
            raise ValueError("Give status and/or for_agent.")
        return self


class LayoutNoteResponse(BaseModel):
    id: str
    document_id: str
    kind: Literal["notice", "annotation"]
    code: str | None = None
    severity: str
    anchor: dict[str, Any]
    message: str
    data: dict[str, Any] | None = None
    revision: int
    author_user_id: str | None = None
    by_agent: bool = False
    status: str
    resolution_note: str | None = None
    created_at: datetime.datetime | None = None
    resolved_at: datetime.datetime | None = None
    parent_id: str | None = None
    for_agent: bool = False
    # Where the anchor is now and what is drawn there (resolved on read; null when
    # the layout service could not be reached).
    where: str | None = None
    located: dict[str, Any] | None = None


class LayoutNotesResponse(BaseModel):
    document_id: str
    revision: int
    notes: list[LayoutNoteResponse]


class LayoutRevisionItem(BaseModel):
    revision: int
    description: str | None = None
    ops_count: int | None = None
    author_user_id: str | None = None
    by_agent: bool = False
    created_at: datetime.datetime | None = None
    # A saved version: the name and note someone gave this revision.
    name: str | None = None
    note: str | None = None
    # What the write did, from its ops: {"ops": {"edit": 2, "place": 1}, "components": ["a", "b"]}.
    summary: dict[str, Any] | None = None


class LayoutRevisionsResponse(BaseModel):
    document_id: str
    revision: int
    revisions: list[LayoutRevisionItem]


class LayoutRevisionResponse(BaseModel):
    document_id: str
    revision: int
    content: dict[str, Any]
    ops: list[dict[str, Any]] | None = None
    description: str | None = None
    created_at: datetime.datetime | None = None
    name: str | None = None
    note: str | None = None
    by_agent: bool = False


class LayoutVersionCreate(BaseModel):
    """Save a version: name a revision (default: the current one)."""

    name: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=2000)
    revision: int | None = Field(default=None, ge=1)


class LayoutRevisionUpdate(BaseModel):
    """Rename a saved version, change its note, or (name: null) take it off the saved list."""

    name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=2000)


# ─── Themes ──────────────────────────────────────────────────


class LayoutThemeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    # Partial @docforge/layout tokens: color, font, size, space, radius, lineHeight.
    tokens: dict[str, Any]


class LayoutThemeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    tokens: dict[str, Any] | None = None


class LayoutThemeResponse(BaseModel):
    id: str
    # Built-in themes only: a stable key ("sober", "night"…).
    key: str | None = None
    name: str
    description: str | None = None
    builtin: bool = False
    by_agent: bool = False
    tokens: dict[str, Any]
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None


class LayoutThemeApply(BaseModel):
    """A theme by id ("builtin:night" or a saved theme's UUID), built-in key ("night") or name."""

    theme: str = Field(min_length=1, max_length=120)


class LayoutThemesResponse(BaseModel):
    themes: list[LayoutThemeResponse]
    # Font families a theme may use (the ones the layout engine measures).
    fonts: list[str]
