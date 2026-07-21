"""Single source of truth for plan tiers.

Served by GET /api/tiers so PricingPage/BillingPage and the backend enforce
the same numbers (eliminates the hardcode drift called out in product-plan
§9.5). Limits are config-driven; pricing copy lives here until Stripe lands.

Princípio (§9.2): créditos só onde o DocForge paga tokens; valor de workflow
é assinatura. A rota BYOA é barata — o Free é generoso nela de propósito.
"""

from app.config import settings


def get_tiers() -> list[dict]:
    return [
        {
            "slug": "free",
            "name": "Free",
            "price_monthly_usd": 0,
            "credits": f"{settings.WEEKLY_CREDITS} credits / week",
            "description": (
                "The full trust layer with one connected agent. "
                "Editor, real-time viewer, MCP, suggestions and curated resources."
            ),
            "features": [
                "Editor + real-time viewer",
                "MCP access (1 connected agent)",
                f"Up to {settings.FREE_MAX_ACTIVE_DOCUMENTS} active documents",
                "Suggestion review & feedback loop",
                "Curated writing guides (ADR, postmortem, runbook, RFC)",
                f"{settings.WEEKLY_CREDITS} weekly credits for guided/pipeline runs",
            ],
            "limits": {
                "max_active_documents": settings.FREE_MAX_ACTIVE_DOCUMENTS,
                "max_api_keys": settings.FREE_MAX_API_KEYS,
                "weekly_credits": settings.WEEKLY_CREDITS,
                "max_versions_per_section": settings.FREE_MAX_VERSIONS_PER_SECTION,
            },
            "cta": "Get started",
            "highlight": False,
            "available": True,
        },
        {
            "slug": "pro",
            "name": "Pro",
            "price_monthly_usd": None,  # price point pending market benchmark (§9 open question)
            "credits": "More credits / month + top-up",
            "description": (
                "For individuals shipping documentation with agents: unlimited agents, "
                "custom pipelines and full history."
            ),
            "features": [
                "Everything in Free",
                "Unlimited connected agents",
                "Unlimited active documents",
                "Custom pipelines, document types & prompts",
                "Full version history",
                "PDF export",
                "More credits + on-demand top-up",
            ],
            "limits": {
                "max_active_documents": None,
                "max_api_keys": None,
                "weekly_credits": None,
                "max_versions_per_section": None,
            },
            "cta": "Upgrade to Pro" if settings.STRIPE_ENABLED else "Coming soon",
            "highlight": True,
            "available": settings.STRIPE_ENABLED,
        },
        {
            "slug": "team",
            "name": "Team",
            "price_monthly_usd": None,
            "credits": "Pooled credits per workspace",
            "description": (
                "Distribute your team's documentation standards to every connected agent, "
                "with audit trail and policy gates."
            ),
            "features": [
                "Everything in Pro, per seat",
                "Shared workspaces",
                "Org-wide standards served via MCP",
                "Quality gates as policy per document type",
                "Per-agent audit trail (compliance)",
                "SSO",
                "Confluence & Linear export",
            ],
            "limits": {
                "max_active_documents": None,
                "max_api_keys": None,
                "weekly_credits": None,
                "max_versions_per_section": None,
            },
            "cta": "Upgrade to Team" if settings.STRIPE_ENABLED else "Coming soon",
            "highlight": False,
            "available": settings.STRIPE_ENABLED,
        },
    ]


def get_limits(plan: str) -> dict:
    for tier in get_tiers():
        if tier["slug"] == plan:
            return tier["limits"]
    return get_tiers()[0]["limits"]  # unknown plan → free limits (safe default)


async def check_document_limit(db, user) -> str | None:
    """Return an error message if creating another document would exceed the plan."""
    from sqlalchemy import func, select

    from app.models.document import Document

    limit = get_limits(user.plan).get("max_active_documents")
    if limit is None:
        return None
    result = await db.execute(
        select(func.count()).select_from(Document).where(Document.user_id == user.id)
    )
    if result.scalar() >= limit:
        return (
            f"Free plan limit reached: {limit} active documents. "
            "Delete a document or upgrade to Pro."
        )
    return None


async def check_api_key_limit(db, user) -> str | None:
    """Return an error message if creating another API key would exceed the plan."""
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
            f"Free plan limit reached: {limit} connected agent(s). "
            "Revoke an existing key or upgrade to Pro."
        )
    return None
