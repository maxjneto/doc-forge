"""Single source of truth for plan tiers and document-creation capacity."""

from app.config import settings


def get_tiers() -> list[dict]:
    return [
        {
            "slug": "free",
            "name": "Free",
            "price_monthly_usd": 0,
            "credits": f"{settings.FREE_WEEKLY_DOCUMENT_CREDITS} document creations / week",
            "description": (
                "A focused workspace for writing with one connected agent. "
                "Review every change, keep history, and publish when ready."
            ),
            "features": [
                "Editor + real-time viewer",
                "MCP access (1 connected agent)",
                f"{settings.FREE_WEEKLY_DOCUMENT_CREDITS} document creations each week",
                f"Up to {settings.FREE_MAX_ACTIVE_DOCUMENTS} active documents",
                "Suggestion review & feedback loop",
                "Writing guides for agents (ADR, postmortem, RFC)",
                "No authenticated exports",
            ],
            "limits": {
                "max_active_documents": settings.FREE_MAX_ACTIVE_DOCUMENTS,
                "max_api_keys": settings.FREE_MAX_API_KEYS,
                "weekly_document_creations": settings.FREE_WEEKLY_DOCUMENT_CREDITS,
                "max_versions_per_section": settings.FREE_MAX_VERSIONS_PER_SECTION,
                "export_formats": [],
            },
            "cta": "Get started",
            "highlight": False,
            "available": True,
        },
        {
            "slug": "pro",
            "name": "Pro",
            "price_monthly_usd": None,
            "credits": f"{settings.PRO_WEEKLY_DOCUMENT_CREDITS} document creations / week",
            "description": (
                "For individuals who run durable documentation workflows with agents."
            ),
            "features": [
                "Everything in Free",
                f"{settings.PRO_WEEKLY_DOCUMENT_CREDITS} document creations each week",
                f"Up to {settings.PRO_MAX_API_KEYS} connected agents",
                f"Up to {settings.PRO_MAX_ACTIVE_DOCUMENTS} active documents",
                "Full version history",
                "Markdown, PDF & DOCX export",
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
        {
            "slug": "team",
            "name": "Team",
            "price_monthly_usd": None,
            "credits": "Capacity model not defined",
            "description": "Planned for shared standards, audit trails, and policy gates.",
            "features": [
                "Everything in Pro, per seat",
                "Shared workspaces",
                "Org-wide standards served via MCP",
                "Quality gates as team policy",
                "Per-agent audit trail (compliance)",
                "SSO",
            ],
            "limits": {
                "max_active_documents": None,
                "max_api_keys": None,
                "weekly_document_creations": None,
                "max_versions_per_section": None,
                "export_formats": [],
            },
            "cta": "Coming soon",
            "highlight": False,
            "available": False,
        },
    ]


def get_limits(plan: str) -> dict:
    for tier in get_tiers():
        if tier["slug"] == plan:
            return tier["limits"]
    return get_tiers()[0]["limits"]


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
