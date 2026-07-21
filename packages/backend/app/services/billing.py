"""Stripe billing — checkout, customer portal, and webhook-driven plan sync.

Disabled by default (STRIPE_ENABLED=false): every entry point raises a clear
409 rather than crashing on missing keys, matching the POSTHOG_ENABLED
pattern elsewhere in this codebase. Flip it on with real (test-mode or live)
keys from the Stripe dashboard when price points are decided (product-plan
§9.5 — Stripe enters when the first Pro feature is sellable, not before).
"""

from __future__ import annotations

import stripe
from fastapi import HTTPException
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


def _configured() -> bool:
    return bool(settings.STRIPE_ENABLED and settings.STRIPE_SECRET_KEY)


def _require_configured() -> None:
    if not _configured():
        raise HTTPException(
            status_code=409,
            detail="Billing is not configured yet. Set STRIPE_ENABLED=true and "
            "STRIPE_SECRET_KEY/STRIPE_PRICE_ID_* once price points are decided.",
        )


def _client() -> stripe.StripeClient:
    return stripe.StripeClient(settings.STRIPE_SECRET_KEY)


def _price_id_for_plan(plan: str) -> str:
    price_id = {
        "pro": settings.STRIPE_PRICE_ID_PRO,
        "team": settings.STRIPE_PRICE_ID_TEAM,
    }.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Unknown or unpriced plan: {plan!r}")
    return price_id


def _plan_for_price_id(price_id: str) -> str:
    prices = {
        settings.STRIPE_PRICE_ID_PRO: "pro",
        settings.STRIPE_PRICE_ID_TEAM: "team",
    }
    return prices.get(price_id, "free")


async def _get_or_create_customer(db: AsyncSession, user: User, client: stripe.StripeClient) -> str:
    """Read-or-create the Stripe customer id.

    Persists via a raw UPDATE (not ORM attribute mutation on `user`) because
    the `user` object here is the FastAPI-injected current_user — it isn't
    guaranteed to be attached to `db`'s identity map, so mutating it directly
    and committing on `db` can silently no-op. Matches the pattern used for
    credits/plan elsewhere in this codebase.
    """
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = client.v1.customers.create(params={"email": user.email, "metadata": {"docforge_user_id": user.id}})
    await db.execute(
        update(User).where(User.id == user.id).values(stripe_customer_id=customer.id)
    )
    await db.commit()
    logger.info("[billing] created Stripe customer | user_id={} customer_id={}", user.id, customer.id)
    return customer.id


async def create_checkout_session(
    db: AsyncSession, user: User, plan: str
) -> str:
    """Create a Checkout Session for a subscription upgrade. Returns the redirect URL."""
    _require_configured()
    client = _client()
    price_id = _price_id_for_plan(plan)
    customer_id = await _get_or_create_customer(db, user, client)

    session = client.v1.checkout.sessions.create(params={
        "mode": "subscription",
        "customer": customer_id,
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": settings.STRIPE_CHECKOUT_SUCCESS_URL,
        "cancel_url": settings.STRIPE_CHECKOUT_CANCEL_URL,
        "client_reference_id": user.id,
        "metadata": {"docforge_user_id": user.id, "plan": plan},
    })
    logger.info("[billing] checkout session created | user_id={} plan={}", user.id, plan)
    return session.url


async def create_portal_session(db: AsyncSession, user: User) -> str:
    """Create a Customer Portal session so the user can manage/cancel their subscription."""
    _require_configured()
    client = _client()
    if not user.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No billing account yet — subscribe first.")
    session = client.v1.billing_portal.sessions.create(params={
        "customer": user.stripe_customer_id,
        "return_url": settings.STRIPE_PORTAL_RETURN_URL,
    })
    return session.url


def _safe_get(obj, key: str, default=None):
    """dict-style .get() that also works on Stripe's typed response objects.

    Stripe's newer SDK resources (e.g. `Subscription` from `client.v1...`,
    and the nested objects inside webhook event payloads) support `[]` and
    `in` like a dict, but do NOT implement `.get()` — calling it raises
    AttributeError('get') via their custom `__getattr__`. Plain dicts (as
    used in tests) raise KeyError instead, so catching both covers each case.
    """
    try:
        return obj[key]
    except (KeyError, TypeError):
        return default


def _extract_price_id(subscription) -> str | None:
    items = _safe_get(subscription, "items", {})
    data = _safe_get(items, "data", []) or []
    if data:
        price = _safe_get(data[0], "price", {})
        return _safe_get(price, "id")
    return None


async def _sync_plan_from_subscription(db: AsyncSession, customer_id: str, subscription: dict) -> None:
    from app.services.observability import capture_account_event

    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()
    if user is None:
        logger.warning("[billing] webhook for unknown Stripe customer | customer_id={}", customer_id)
        return

    subscription_id = _safe_get(subscription, "id")
    status_ = _safe_get(subscription, "status")

    if (
        status_ in ("canceled", "unpaid", "incomplete_expired")
        and user.stripe_subscription_id
        and user.stripe_subscription_id != subscription_id
    ):
        # Event is about a stale/duplicate subscription (e.g. an abandoned
        # checkout retried after failure), not the one currently on file —
        # ignore it instead of downgrading a still-active subscriber.
        logger.info(
            "[billing] ignoring {} event for non-current subscription | user_id={} event_sub={} current_sub={}",
            status_, user.id, subscription_id, user.stripe_subscription_id,
        )
        return

    previous_plan = user.plan
    if status_ in ("active", "trialing"):
        price_id = _extract_price_id(subscription)
        user.plan = _plan_for_price_id(price_id) if price_id else user.plan
        user.stripe_subscription_id = subscription_id
    elif status_ in ("canceled", "unpaid", "incomplete_expired"):
        user.plan = "free"
        user.stripe_subscription_id = None
    await db.commit()

    # Funnel step: conversion (product-plan §9 funnel — MCP connect → first
    # doc → first suggestion reviewed → conversion). Free-to-paid transition
    # is the actual money event; downgrades are logged but not double-counted
    # as a distinct funnel step.
    if previous_plan == "free" and user.plan in ("pro", "team"):
        capture_account_event(user.id, "subscription_converted", {"plan": user.plan})

    logger.info(
        "[billing] plan synced from subscription | user_id={} plan={} status={}",
        user.id, user.plan, status_,
    )


async def handle_webhook_event(db: AsyncSession, payload: bytes, sig_header: str) -> None:
    """Verify and process a Stripe webhook event.

    Handles the two events that matter for plan state: checkout completion
    (first subscribe) and subscription lifecycle changes (upgrade/downgrade/
    cancel) — the source of truth stays the subscription object, not the
    one-off checkout event, so renewals/cancellations from the Stripe
    dashboard also propagate correctly.
    """
    _require_configured()
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError) as e:
        logger.warning("[billing] webhook signature verification failed: {}", e)
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info("[billing] webhook received | type={}", event_type)

    if event_type == "checkout.session.completed":
        customer_id = _safe_get(data, "customer")
        subscription_id = _safe_get(data, "subscription")
        if customer_id and subscription_id:
            client = _client()
            subscription = client.v1.subscriptions.retrieve(subscription_id)
            await _sync_plan_from_subscription(db, customer_id, subscription)
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer_id = _safe_get(data, "customer")
        if customer_id:
            await _sync_plan_from_subscription(db, customer_id, data)
    else:
        logger.debug("[billing] ignoring unhandled webhook event type={}", event_type)
