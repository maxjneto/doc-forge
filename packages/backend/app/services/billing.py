"""Stripe billing — checkout, customer portal, and webhook-driven plan sync.

Disabled by default (STRIPE_ENABLED=false): every entry point raises a clear
409 rather than crashing on missing keys, matching the POSTHOG_ENABLED
pattern elsewhere in this codebase. Flip it on with real (test-mode or live)
keys from the Stripe dashboard once the prices exist.
"""

from __future__ import annotations

import stripe
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
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
    """The plan an ACTIVE subscription on this price grants.

    A price we don't know (an older Pro price after a price change, a price
    created by hand in the dashboard) still belongs to someone who is paying,
    so it grants Pro instead of silently dropping them to Free.
    """
    prices = {
        pid: plan
        for pid, plan in ((settings.STRIPE_PRICE_ID_PRO, "pro"), (settings.STRIPE_PRICE_ID_TEAM, "team"))
        if pid
    }
    if price_id in prices:
        return prices[price_id]
    logger.warning("[billing] active subscription on an unknown price, granting Pro | price_id={}", price_id)
    return "pro"


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
    customer = await run_in_threadpool(
        client.v1.customers.create,
        params={"email": user.email, "metadata": {"docforge_user_id": user.id}},
    )
    await db.execute(
        update(User).where(User.id == user.id).values(stripe_customer_id=customer.id)
    )
    await db.commit()
    logger.info("[billing] created Stripe customer | user_id={} customer_id={}", user.id, customer.id)
    return customer.id


# Still paid for, or about to be (past_due keeps the plan while Stripe retries the card).
LIVE_STATUSES = ("active", "trialing", "past_due")
# The plan ends. "paused" only happens to a trial that ended without a card.
ENDED_STATUSES = ("canceled", "unpaid", "incomplete_expired", "paused")
# Checkouts abandoned before the first payment (3D Secure left halfway): not a used trial.
NEVER_STARTED = ("incomplete", "incomplete_expired")


async def _subscription_history(client: stripe.StripeClient, customer_id: str) -> list:
    """Every subscription this customer has had, newest first."""
    result = await run_in_threadpool(
        client.v1.subscriptions.list, params={"customer": customer_id, "status": "all", "limit": 20}
    )
    return list(_safe_get(result, "data", []) or [])


def _trial_days(history: list) -> int:
    """Free days for this checkout: only on a person's first subscription."""
    if settings.STRIPE_TRIAL_DAYS <= 0:
        return 0
    if any(_safe_get(subscription, "status") not in NEVER_STARTED for subscription in history):
        return 0
    return settings.STRIPE_TRIAL_DAYS


async def create_checkout_session(
    db: AsyncSession, user: User, plan: str
) -> str:
    """Create a Checkout Session for a subscription upgrade. Returns the redirect URL."""
    _require_configured()
    if user.plan != "free" and user.stripe_subscription_id:
        # A second checkout would start a second subscription and bill twice.
        # Plan changes and cancellations go through the customer portal.
        raise HTTPException(
            status_code=409,
            detail="You already have a subscription. Manage it from the billing page.",
        )
    client = _client()
    price_id = _price_id_for_plan(plan)
    customer_id = await _get_or_create_customer(db, user, client)

    # The local plan only changes when Stripe's webhook lands. If it is late (or was
    # lost), the check above passes and a second payment would open a second
    # subscription. Stripe is the source of truth: ask it, and heal the plan here.
    history = await _subscription_history(client, customer_id)
    live = next((s for s in history if _safe_get(s, "status") in LIVE_STATUSES), None)
    if live is not None:
        await _sync_plan_from_subscription(db, customer_id, live)
        raise HTTPException(
            status_code=409,
            detail="You already have a subscription. Manage it from the billing page.",
        )

    trial_days = _trial_days(history)
    subscription_data: dict = {"metadata": {"docforge_user_id": user.id, "plan": plan}}
    if trial_days:
        subscription_data["trial_period_days"] = trial_days
        # The card is always asked for, so the trial turns into Pro unless they cancel.
        # Should a trial ever end without one, it ends: no "paused" limbo.
        subscription_data["trial_settings"] = {"end_behavior": {"missing_payment_method": "cancel"}}

    session = await run_in_threadpool(client.v1.checkout.sessions.create, params={
        "mode": "subscription",
        "customer": customer_id,
        "line_items": [{"price": price_id, "quantity": 1}],
        "payment_method_collection": "always",
        "subscription_data": subscription_data,
        "success_url": settings.STRIPE_CHECKOUT_SUCCESS_URL,
        "cancel_url": settings.STRIPE_CHECKOUT_CANCEL_URL,
        "client_reference_id": user.id,
        "metadata": {"docforge_user_id": user.id, "plan": plan},
    })
    logger.info("[billing] checkout session created | user_id={} plan={} trial_days={}", user.id, plan, trial_days)
    from app.services.observability import capture_account_event

    capture_account_event(
        user, "checkout_started", {"plan": plan, "currency": settings.PRICE_CURRENCY, "trial_days": trial_days}
    )
    return session.url


async def create_portal_session(db: AsyncSession, user: User) -> str:
    """Create a Customer Portal session so the user can manage/cancel their subscription."""
    _require_configured()
    client = _client()
    if not user.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No billing account yet — subscribe first.")
    session = await run_in_threadpool(client.v1.billing_portal.sessions.create, params={
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


def _ended_during_trial(subscription) -> bool:
    trial_end = _safe_get(subscription, "trial_end")
    ended_at = _safe_get(subscription, "ended_at") or _safe_get(subscription, "canceled_at")
    return bool(trial_end and ended_at and ended_at <= trial_end)


async def _sync_plan_from_subscription(
    db: AsyncSession, customer_id: str, subscription: dict, previous_status: str | None = None
) -> None:
    """Make the account's plan match a subscription.

    `previous_status` is the status the subscription had before this event
    (Stripe's `previous_attributes`), when known: it tells a trial that just
    turned paid apart from one that is still running.
    """
    from app.services.observability import capture_account_event

    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()
    if user is None:
        logger.warning("[billing] webhook for unknown Stripe customer | customer_id={}", customer_id)
        return

    subscription_id = _safe_get(subscription, "id")
    status_ = _safe_get(subscription, "status")

    if (
        status_ in ENDED_STATUSES
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
    elif status_ in ENDED_STATUSES:
        user.plan = "free"
        user.stripe_subscription_id = None
    # This week's allowance follows the plan: what was already used still counts,
    # the rest moves by the difference (free → Pro: 15 left becomes 100 left).
    from app.services.credits import weekly_document_allowance

    delta = weekly_document_allowance(user.plan) - weekly_document_allowance(previous_plan)
    if delta:
        user.credits = max(0, (user.credits or 0) + delta)
    await db.commit()

    # The money events, last step of the activation funnel. The plan also goes on
    # the person (for people who accepted analytics) so every chart can split by it.
    # subscription_started always means paying: a trial starts as trial_started and
    # becomes subscription_started (from_trial) when its first charge goes through.
    if previous_plan == "free" and user.plan != "free":
        if status_ == "trialing":
            capture_account_event(user, "trial_started", {"plan": user.plan}, person={"plan": user.plan})
        else:
            capture_account_event(user, "subscription_started", {"plan": user.plan, "from_trial": False}, person={"plan": user.plan})
    elif previous_plan != "free" and user.plan == "free":
        capture_account_event(
            user,
            "subscription_canceled",
            {"plan": previous_plan, "status": status_, "during_trial": _ended_during_trial(subscription)},
            person={"plan": "free"},
        )
    elif previous_status == "trialing" and status_ == "active":
        capture_account_event(user, "subscription_started", {"plan": user.plan, "from_trial": True})

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
            subscription = await run_in_threadpool(client.v1.subscriptions.retrieve, subscription_id)
            await _sync_plan_from_subscription(db, customer_id, subscription)
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer_id = _safe_get(data, "customer")
        subscription_id = _safe_get(data, "id")
        if customer_id:
            # Stripe does not promise order: an "updated: active" sent before a
            # cancellation can arrive after it and would hand Pro back. So the
            # event only says *which* subscription changed; its state is read
            # from Stripe now. If that read fails, the 500 makes Stripe retry.
            subscription = data
            if subscription_id:
                subscription = await run_in_threadpool(_client().v1.subscriptions.retrieve, subscription_id)
            previous = _safe_get(event["data"], "previous_attributes") or {}
            await _sync_plan_from_subscription(
                db, customer_id, subscription, previous_status=_safe_get(previous, "status")
            )
    else:
        logger.debug("[billing] ignoring unhandled webhook event type={}", event_type)
