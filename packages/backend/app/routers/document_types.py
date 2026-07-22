import datetime
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user, get_current_user_optional
from app.config import settings
from app.database import get_db
from app.models.ai_usage import AiUsageEvent
from app.models.document_type import DocumentType, SectionDefinition
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.schemas.document_type import (
    DocumentTypeCreateRequest,
    DocumentTypeResponse,
    PromptTemplateResponse,
    PromptUpsertRequest,
    SectionSummaryGenerateRequest,
    SectionSummaryGenerateResponse,
)

router = APIRouter(tags=["document-types"])

_SLUG_WORD_RE = re.compile(r"[^a-z0-9]+")
_NON_ALNUM_RE = re.compile(r"[^a-zA-Z0-9]")


def _slugify(text: str) -> str:
    s = _SLUG_WORD_RE.sub("-", text.lower()).strip("-")
    return s or "type"


def _user_slug_suffix(user_id: str) -> str:
    alnum = _NON_ALNUM_RE.sub("", user_id)
    return (alnum[-8:] or "user").lower()


async def _generate_unique_slug(db: AsyncSession, name: str, user_id: str) -> str:
    """slugify(name) + a per-user suffix, retried on collision.

    The slug is never user input — this both satisfies "no slug field in the
    form" and fixes the pre-existing global slug namespace (two users could
    otherwise race for the same slug).
    """
    base = _slugify(name)[:35]
    suffix = _user_slug_suffix(user_id)
    candidate = f"{base}-{suffix}"
    attempt = 1
    while True:
        existing = await db.execute(select(DocumentType.id).where(DocumentType.slug == candidate))
        if existing.scalar_one_or_none() is None:
            return candidate
        attempt += 1
        candidate = f"{base}-{suffix}-{attempt}"


def _to_response(dt: DocumentType) -> DocumentTypeResponse:
    return DocumentTypeResponse(
        id=dt.id,
        slug=dt.slug,
        name=dt.name,
        description=dt.description,
        is_active=dt.is_active,
        is_custom=dt.user_id is not None,
        sections=dt.section_definitions,
    )


def _require_customization(user: User) -> None:
    if (user.plan or "free") == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Custom document types are a Pro feature.",
        )


@router.get("/document-types", response_model=list[DocumentTypeResponse])
async def list_document_types(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Global (seeded) types for everyone; plus the caller's custom types when authenticated."""
    visibility = DocumentType.user_id.is_(None)
    if current_user is not None:
        visibility = or_(visibility, DocumentType.user_id == current_user.id)
    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.is_active.is_(True), visibility)
        .order_by(DocumentType.created_at)
    )
    return [_to_response(dt) for dt in result.scalars().all()]


@router.get("/document-types/{slug}", response_model=DocumentTypeResponse)
async def get_document_type(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    visibility = DocumentType.user_id.is_(None)
    if current_user is not None:
        visibility = or_(visibility, DocumentType.user_id == current_user.id)
    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.slug == slug, DocumentType.is_active.is_(True), visibility)
    )
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    return _to_response(dt)


@router.post("/document-types", response_model=DocumentTypeResponse, status_code=201)
async def create_document_type(
    payload: DocumentTypeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a user-owned custom document type (P3 completa — Pro feature).

    The slug is derived server-side from the name plus a per-user suffix
    (retried on collision) — it is not user input.
    """
    _require_customization(current_user)

    orders = [s.order for s in payload.sections]
    if len(set(orders)) != len(orders):
        raise HTTPException(status_code=422, detail="Section orders must be unique.")
    keys = [s.section_key for s in payload.sections]
    if len(set(keys)) != len(keys):
        raise HTTPException(status_code=422, detail="Section keys must be unique.")

    slug = await _generate_unique_slug(db, payload.name, current_user.id)

    dt = DocumentType(
        slug=slug,
        name=payload.name,
        description=payload.description,
        is_active=True,
        user_id=current_user.id,
    )
    db.add(dt)
    await db.flush()
    for s in payload.sections:
        db.add(SectionDefinition(
            document_type_id=dt.id,
            section_key=s.section_key,
            display_name=s.display_name,
            order=s.order,
            role_description=s.role_description,
        ))
    await db.commit()

    result = await db.execute(
        select(DocumentType)
        .options(selectinload(DocumentType.section_definitions))
        .where(DocumentType.id == dt.id)
    )
    return _to_response(result.scalar_one())


@router.put("/document-types/{slug}/prompts", response_model=PromptTemplateResponse)
async def upsert_prompt(
    slug: str,
    payload: PromptUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a prompt template on a custom type you own.

    These prompts are the single source for both pipeline step instructions
    and (future) server-side execution — customized once, used everywhere.
    """
    _require_customization(current_user)
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.slug == slug, DocumentType.user_id == current_user.id
        )
    )
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(status_code=404, detail="Custom document type not found")

    tmpl_result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.document_type_id == dt.id,
            PromptTemplate.phase == payload.phase,
            PromptTemplate.section_key == payload.section_key
            if payload.section_key is not None
            else PromptTemplate.section_key.is_(None),
        )
    )
    tmpl = tmpl_result.scalar_one_or_none()
    if tmpl:
        tmpl.prompt_text = payload.prompt_text
    else:
        tmpl = PromptTemplate(
            document_type_id=dt.id,
            phase=payload.phase,
            section_key=payload.section_key,
            prompt_text=payload.prompt_text,
        )
        db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return PromptTemplateResponse.model_validate(tmpl)


async def _check_and_record_ai_usage(db: AsyncSession, user_id: str, kind: str) -> None:
    """Free-tier AI rate limit: N calls per rolling window, counted in Postgres
    (REDIS_URL is optional in this project, so no in-memory/Redis counter)."""
    window_start = datetime.datetime.now(datetime.UTC) - datetime.timedelta(
        hours=settings.AI_SECTION_SUMMARY_WINDOW_HOURS
    )
    result = await db.execute(
        select(func.count()).select_from(AiUsageEvent).where(
            AiUsageEvent.user_id == user_id,
            AiUsageEvent.kind == kind,
            AiUsageEvent.created_at >= window_start,
        )
    )
    if (result.scalar_one() or 0) >= settings.AI_SECTION_SUMMARY_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Rate limit reached: {settings.AI_SECTION_SUMMARY_RATE_LIMIT} AI "
                f"generations per {settings.AI_SECTION_SUMMARY_WINDOW_HOURS}h. Try again later."
            ),
        )
    db.add(AiUsageEvent(user_id=user_id, kind=kind))
    await db.commit()


@router.post("/document-types/generate-section-summary", response_model=SectionSummaryGenerateResponse)
async def generate_section_summary(
    payload: SectionSummaryGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI-assisted draft of a section's role_description for the "new document
    type" form. Free (no credits) — Pro-gated and rate-limited per user instead,
    since the section doesn't exist yet: this reads the in-memory form state
    (type name/description + section display name), not a saved section.
    """
    _require_customization(current_user)
    await _check_and_record_ai_usage(db, current_user.id, "section_summary")

    from app.guardrails import call_with_retry

    messages = [
        {
            "role": "system",
            "content": (
                "You write a single tight 1-2 sentence role description for a section "
                "of a structured document type. The description tells a writer what "
                "that section must contain. Be concrete and specific to the document "
                "type and section given — never generic. Output only the description "
                "text: no quotes, no preamble, no markdown."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Document type: {payload.document_type_name}\n"
                f"Document type description: {payload.document_type_description}\n"
                f"Section name: {payload.section_display_name}\n\n"
                "Write the role description for this section."
            ),
        },
    ]
    response = await call_with_retry(
        phase="document_type_section_summary",
        messages=messages,
        temperature=0.4,
        posthog_distinct_id=str(current_user.id),
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="AI generation failed; please try again.")
    return SectionSummaryGenerateResponse(role_description=text[:2000])
