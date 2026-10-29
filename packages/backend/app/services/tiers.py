"""Single source of truth for plan tiers and document-creation capacity."""

from app.config import settings


def get_tiers() -> list[dict]:
    """The plans, in display order. Free carries everything DocForge does; Pro
    lifts the limits. Teams are handled by contact, not a self-serve plan."""
    return [
        {
            "slug": "free",
            "name": "Free",
            "price_monthly_usd": 0,
            "credits": f"{settings.FREE_WEEKLY_DOCUMENT_CREDITS} new documents / week",
            "description": "Everything DocForge does, for one person and their agents.",
            "features": [
                "Markdown documents and layout pages and slides",
                f"{settings.FREE_WEEKLY_DOCUMENT_CREDITS} new documents each week",
                f"Up to {settings.FREE_MAX_ACTIVE_DOCUMENTS} active documents",
                f"{settings.FREE_MAX_API_KEYS} connected agents (MCP)",
                "Review agent changes as suggestions",
                f"{settings.FREE_MAX_VERSIONS_PER_SECTION} versions per document",
                "Comments, sharing and public links",
                "Markdown and PDF export",
            ],
            "limits": {
                "max_active_documents": settings.FREE_MAX_ACTIVE_DOCUMENTS,
                "max_api_keys": settings.FREE_MAX_API_KEYS,
                "weekly_document_creations": settings.FREE_WEEKLY_DOCUMENT_CREDITS,
                "max_versions_per_section": settings.FREE_MAX_VERSIONS_PER_SECTION,
                "export_formats": ["md", "pdf"],
            },
            "cta": "Start for free",
            "highlight": False,
            "available": True,
        },
        {
            "slug": "pro",
            "name": "Pro",
            "price_monthly_usd": settings.PRO_PRICE_MONTHLY_USD,
            "credits": f"{settings.PRO_WEEKLY_DOCUMENT_CREDITS} new documents / week",
            "description": "For people who write with agents every day.",
            "features": [
                "Everything in Free",
                f"{settings.PRO_WEEKLY_DOCUMENT_CREDITS} new documents each week",
                f"Up to {settings.PRO_MAX_ACTIVE_DOCUMENTS} active documents",
                f"{settings.PRO_MAX_API_KEYS} connected agents (MCP)",
                "Full version history",
                "Word export",
            ],
            "limits": {
                "max_active_documents": settings.PRO_MAX_ACTIVE_DOCUMENTS,
                "max_api_keys": settings.PRO_MAX_API_KEYS,
                "weekly_document_creations": settings.PRO_WEEKLY_DOCUMENT_CREDITS,
                "max_versions_per_section": None,
                "export_formats": ["md", "pdf", "docx"],
            },
            "cta": "Upgrade to Pro" if settings.STRIPE_ENABLED else "Coming soon",
            "highlight": True,
            "available": settings.STRIPE_ENABLED,
        },
    ]


def get_limits(plan: str) -> dict:
    tiers = {tier["slug"]: tier["limits"] for tier in get_tiers()}
    if plan in tiers:
        return tiers[plan]
    # A paid plan that is not listed (a team set up by hand) gets Pro's limits.
    return tiers["free"] if plan in ("", None) else tiers["pro"]


async def check_document_limit(db, user) -> str | None:
    """Return an error if another active document would exceed the plan."""
    from sqlalchemy import func, select

    from app.models.document import Document

    limit = get_limits(user.plan).get("max_active_documents")
    if limit is None:
        return None
    result = await db.execute(
        select(func.count()).select_from(Document).where(
            Document.user_id == user.id,
            Document.archived_at.is_(None),
        )
    )
    if result.scalar() >= limit:
        return (
            f"Active document limit reached: {limit}. "
            "Archive a document or upgrade to Pro."
        )
    return None


async def check_api_key_limit(db, user) -> str | None:
    """Return an error if another connected agent would exceed the plan."""
    from sqlalchemy import func, select

    from app.models.api_key import ApiKey

    limit = get_limits(user.plan).get("max_api_keys")
    if limit is None:
        return None
    result = await db.execute(
        select(func.count()).select_from(ApiKey).where(
            ApiKey.user_id == user.id, ApiKey.revoked_at.is_(None)
        )
    )
    if result.scalar() >= limit:
        return (
            f"Agent limit reached: {limit}. Revoke an existing key or upgrade to Pro."
        )
    return None
