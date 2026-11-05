"""Tests for Stripe billing: checkout, portal, webhook-driven plan sync.

Stripe itself is always mocked — these tests never hit the network. They
verify our own logic: URL construction, customer creation/reuse, and that
webhook events correctly transition User.plan.
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from app.config import settings
from app.models.user import User

from .conftest import TestSession


@pytest.fixture
def stripe_enabled(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_ENABLED", True)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_fake")
    monkeypatch.setattr(settings, "STRIPE_PRICE_ID_PRO", "price_pro_123")
    monkeypatch.setattr(settings, "STRIPE_PRICE_ID_TEAM", "price_team_123")


def _mock_stripe_client():
    client = MagicMock()
    client.v1.customers.create.return_value = MagicMock(id="cus_new123")
    client.v1.checkout.sessions.create.return_value = MagicMock(url="https://checkout.stripe.com/session/xyz")
    client.v1.billing_portal.sessions.create.return_value = MagicMock(url="https://billing.stripe.com/portal/xyz")
    return client


async def _post_webhook(client, event, current=None):
    """Deliver `event`; `current` is what Stripe answers when the subscription is read back."""
    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.retrieve.return_value = current if current is not None else event["data"]["object"]
    with patch("stripe.Webhook.construct_event", return_value=event),          patch("app.services.billing._client", return_value=mock_client):
        res = await client.post("/api/webhooks/stripe", content=b"{}", headers={"stripe-signature": "t=1,v1=fake"})
    return res, mock_client


@pytest.mark.asyncio
async def test_checkout_disabled_by_default(client_factory):
    """Without STRIPE_ENABLED, checkout/portal fail clearly instead of crashing."""
    user = User(id="u_bill1", email="b1@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        res = await client.post("/api/billing/checkout", json={"plan": "pro"})
        assert res.status_code == 409
        assert "not configured" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_checkout_creates_customer_and_returns_url(client_factory, stripe_enabled):
    user = User(id="u_bill2", email="b2@test.com", name="B", credits=5)
    mock_client = _mock_stripe_client()
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/checkout", json={"plan": "pro"})
    assert res.status_code == 200
    assert res.json()["url"] == "https://checkout.stripe.com/session/xyz"
    mock_client.v1.customers.create.assert_called_once()
    mock_client.v1.checkout.sessions.create.assert_called_once()
    call_kwargs = mock_client.v1.checkout.sessions.create.call_args.kwargs["params"]
    assert call_kwargs["line_items"][0]["price"] == "price_pro_123"
    assert call_kwargs["customer"] == "cus_new123"

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill2"))
        assert result.scalar_one().stripe_customer_id == "cus_new123"


@pytest.mark.asyncio
async def test_checkout_reuses_existing_customer(client_factory, stripe_enabled):
    user = User(id="u_bill3", email="b3@test.com", name="B", credits=5, stripe_customer_id="cus_existing")
    mock_client = _mock_stripe_client()
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/checkout", json={"plan": "team"})
    assert res.status_code == 200
    mock_client.v1.customers.create.assert_not_called()
    call_kwargs = mock_client.v1.checkout.sessions.create.call_args.kwargs["params"]
    assert call_kwargs["customer"] == "cus_existing"
    assert call_kwargs["line_items"][0]["price"] == "price_team_123"


@pytest.mark.asyncio
async def test_checkout_rejects_unknown_plan(client_factory, stripe_enabled):
    user = User(id="u_bill4", email="b4@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        res = await client.post("/api/billing/checkout", json={"plan": "enterprise"})
    assert res.status_code == 422  # fails Pydantic pattern validation


@pytest.mark.asyncio
async def test_portal_requires_existing_customer(client_factory, stripe_enabled):
    user = User(id="u_bill5", email="b5@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=_mock_stripe_client()):
            res = await client.post("/api/billing/portal")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_portal_returns_url_for_existing_customer(client_factory, stripe_enabled):
    user = User(id="u_bill6", email="b6@test.com", name="B", credits=5, stripe_customer_id="cus_abc")
    mock_client = _mock_stripe_client()
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/portal")
    assert res.status_code == 200
    assert res.json()["url"] == "https://billing.stripe.com/portal/xyz"


@pytest.mark.asyncio
async def test_a_stripe_refusal_is_a_clear_502(client_factory, stripe_enabled):
    """E.g. a restricted key without Customer Portal: Write. Not a bare 500."""
    import stripe

    user = User(id="u_bill_perm", email="perm@test.com", name="B", credits=5, stripe_customer_id="cus_perm")
    mock_client = _mock_stripe_client()
    mock_client.v1.billing_portal.sessions.create.side_effect = stripe.PermissionError("more_permissions_required")
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/portal")
    assert res.status_code == 502
    assert "payment provider" in res.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_checkout_completed_upgrades_plan(client_factory, stripe_enabled):
    user = User(id="u_bill7", email="b7@test.com", name="B", credits=5, stripe_customer_id="cus_webhook1")
    async with client_factory(user) as seed_client:
        await seed_client.get("/api/users/me")  # triggers _seed_user with stripe_customer_id set

    fake_event = {
        "type": "checkout.session.completed",
        "data": {"object": {"customer": "cus_webhook1", "subscription": "sub_123"}},
    }
    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.retrieve.return_value = {
        "id": "sub_123",
        "status": "active",
        "items": {"data": [{"price": {"id": "price_pro_123"}}]},
    }

    async with client_factory(user) as client:
        with patch("stripe.Webhook.construct_event", return_value=fake_event), \
             patch("app.services.billing._client", return_value=mock_client):
            res = await client.post(
                "/api/webhooks/stripe",
                content=b"{}",
                headers={"stripe-signature": "t=1,v1=fake"},
            )
    assert res.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill7"))
        db_user = result.scalar_one()
        assert db_user.plan == "pro"
        assert db_user.stripe_subscription_id == "sub_123"
        # The week's allowance follows the plan: 5 left of 15 (10 used) is 90 left of 100.
        assert db_user.credits == 90


@pytest.mark.asyncio
async def test_checkout_refused_when_already_subscribed(client_factory, stripe_enabled):
    """A second checkout would open a second subscription and bill twice."""
    user = User(
        id="u_bill_dup", email="dup@test.com", name="B", credits=5,
        plan="pro", stripe_customer_id="cus_dup", stripe_subscription_id="sub_dup",
    )
    mock_client = _mock_stripe_client()
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/checkout", json={"plan": "pro"})
    assert res.status_code == 409
    mock_client.v1.checkout.sessions.create.assert_not_called()


@pytest.mark.asyncio
async def test_checkout_asks_stripe_when_the_webhook_was_lost(client_factory, stripe_enabled):
    """Paid, but the webhook never arrived: the plan still reads Free. A second
    checkout must not open a second subscription; the plan is healed instead."""
    user = User(id="u_bill_lost", email="lost@test.com", name="B", credits=5, stripe_customer_id="cus_lost")
    async with client_factory(user) as seed_client:
        await seed_client.get("/api/users/me")

    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.list.return_value = {"data": [
        {"id": "sub_old_canceled", "status": "canceled", "items": {"data": [{"price": {"id": "price_pro_123"}}]}},
        {"id": "sub_paid", "status": "active", "items": {"data": [{"price": {"id": "price_pro_123"}}]}},
    ]}
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/checkout", json={"plan": "pro"})
    assert res.status_code == 409
    mock_client.v1.checkout.sessions.create.assert_not_called()
    assert mock_client.v1.subscriptions.list.call_args.kwargs["params"]["customer"] == "cus_lost"

    async with TestSession() as session:
        healed = (await session.execute(select(User).where(User.id == "u_bill_lost"))).scalar_one()
        assert healed.plan == "pro" and healed.stripe_subscription_id == "sub_paid"


@pytest.mark.asyncio
async def test_webhook_active_on_unknown_price_keeps_paid_plan(client_factory, stripe_enabled):
    """After a price change, people still paying the old price must not drop to Free."""
    user = User(
        id="u_bill_old", email="old@test.com", name="B", credits=5,
        plan="pro", stripe_customer_id="cus_old", stripe_subscription_id="sub_old",
    )
    async with client_factory(user) as seed_client:
        await seed_client.get("/api/users/me")

    fake_event = {
        "type": "customer.subscription.updated",
        "data": {"object": {
            "id": "sub_old", "customer": "cus_old", "status": "active",
            "items": {"data": [{"price": {"id": "price_retired_999"}}]},
        }},
    }
    async with client_factory(user) as client:
        res, _ = await _post_webhook(client, fake_event)
    assert res.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill_old"))
        assert result.scalar_one().plan == "pro"


@pytest.mark.asyncio
async def test_webhook_subscription_deleted_reverts_to_free(client_factory, stripe_enabled):
    user = User(
        id="u_bill8", email="b8@test.com", name="B", credits=5,
        plan="pro", stripe_customer_id="cus_webhook2", stripe_subscription_id="sub_456",
    )
    async with client_factory(user) as seed_client:
        await seed_client.get("/api/users/me")

    fake_event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_webhook2", "status": "canceled", "id": "sub_456"}},
    }

    async with client_factory(user) as client:
        res, _ = await _post_webhook(client, fake_event)
    assert res.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill8"))
        db_user = result.scalar_one()
        assert db_user.plan == "free"
        assert db_user.stripe_subscription_id is None
        # And back: 5 left of 100 (95 used) is more than the free 15, so 0, never negative.
        assert db_user.credits == 0


@pytest.mark.asyncio
async def test_webhook_deleted_ignores_stale_subscription(client_factory, stripe_enabled):
    """A cancel event for a subscription that isn't the user's current one

    (e.g. an abandoned/duplicate checkout retried after a transient failure)
    must not downgrade an otherwise-active subscriber.
    """
    user = User(
        id="u_bill13", email="b13@test.com", name="B", credits=5,
        plan="pro", stripe_customer_id="cus_webhook3", stripe_subscription_id="sub_current",
    )
    async with client_factory(user) as seed_client:
        await seed_client.get("/api/users/me")

    fake_event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_webhook3", "status": "canceled", "id": "sub_stale"}},
    }

    async with client_factory(user) as client:
        res, _ = await _post_webhook(client, fake_event)
    assert res.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill13"))
        db_user = result.scalar_one()
        assert db_user.plan == "pro"
        assert db_user.stripe_subscription_id == "sub_current"


def _sub(id_, status, **extra):
    return {"id": id_, "status": status, "items": {"data": [{"price": {"id": "price_pro_123"}}]}, **extra}


async def _seed(client_factory, user):
    async with client_factory(user) as seed_client:
        await seed_client.get("/api/users/me")


async def _plan_of(user_id):
    async with TestSession() as session:
        return (await session.execute(select(User).where(User.id == user_id))).scalar_one()


@pytest.mark.asyncio
async def test_first_checkout_gets_the_trial_with_a_card(client_factory, stripe_enabled):
    user = User(id="u_trial1", email="t1@test.com", name="T", credits=5)
    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.list.return_value = {"data": []}
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/checkout", json={"plan": "pro"})
    assert res.status_code == 200
    params = mock_client.v1.checkout.sessions.create.call_args.kwargs["params"]
    assert params["subscription_data"]["trial_period_days"] == 7
    assert params["payment_method_collection"] == "always"
    assert params["subscription_data"]["trial_settings"]["end_behavior"]["missing_payment_method"] == "cancel"


@pytest.mark.asyncio
async def test_no_second_trial_after_any_real_subscription(client_factory, stripe_enabled):
    user = User(id="u_trial2", email="t2@test.com", name="T", credits=5, stripe_customer_id="cus_t2")
    await _seed(client_factory, user)
    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.list.return_value = {"data": [_sub("sub_gone", "canceled")]}
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            res = await client.post("/api/billing/checkout", json={"plan": "pro"})
    assert res.status_code == 200
    params = mock_client.v1.checkout.sessions.create.call_args.kwargs["params"]
    assert "trial_period_days" not in params["subscription_data"]


@pytest.mark.asyncio
async def test_an_abandoned_checkout_does_not_use_up_the_trial(client_factory, stripe_enabled):
    user = User(id="u_trial3", email="t3@test.com", name="T", credits=5, stripe_customer_id="cus_t3")
    await _seed(client_factory, user)
    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.list.return_value = {"data": [_sub("sub_3ds", "incomplete_expired")]}
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            await client.post("/api/billing/checkout", json={"plan": "pro"})
    params = mock_client.v1.checkout.sessions.create.call_args.kwargs["params"]
    assert params["subscription_data"]["trial_period_days"] == 7


@pytest.mark.asyncio
async def test_trials_can_be_turned_off(client_factory, stripe_enabled, monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_TRIAL_DAYS", 0)
    user = User(id="u_trial4", email="t4@test.com", name="T", credits=5)
    mock_client = _mock_stripe_client()
    mock_client.v1.subscriptions.list.return_value = {"data": []}
    async with client_factory(user) as client:
        with patch("app.services.billing._client", return_value=mock_client):
            await client.post("/api/billing/checkout", json={"plan": "pro"})
        tiers = {t["slug"]: t for t in (await client.get("/api/tiers")).json()["tiers"]}
    params = mock_client.v1.checkout.sessions.create.call_args.kwargs["params"]
    assert "trial_period_days" not in params["subscription_data"]
    assert tiers["pro"]["trial_days"] == 0


@pytest.mark.asyncio
async def test_trial_grants_pro_then_turns_paid(client_factory, stripe_enabled):
    user = User(id="u_trial5", email="t5@test.com", name="T", credits=5, stripe_customer_id="cus_t5")
    await _seed(client_factory, user)
    events = []
    with patch("app.services.observability.capture_account_event", side_effect=lambda u, e, *a, **k: events.append(e)):
        async with client_factory(user) as client:
            started = {"type": "customer.subscription.updated", "data": {"object": _sub("sub_t5", "trialing", customer="cus_t5")}}
            res, _ = await _post_webhook(client, started)
            assert res.status_code == 200
            assert (await _plan_of("u_trial5")).plan == "pro"

            converted = {
                "type": "customer.subscription.updated",
                "data": {"object": _sub("sub_t5", "active", customer="cus_t5"), "previous_attributes": {"status": "trialing"}},
            }
            await _post_webhook(client, converted)
    assert (await _plan_of("u_trial5")).plan == "pro"
    assert events == ["trial_started", "subscription_started"]


@pytest.mark.asyncio
async def test_a_late_active_event_does_not_undo_a_cancellation(client_factory, stripe_enabled):
    """Stripe can deliver an older "active" after the cancellation: Stripe's current state wins."""
    user = User(id="u_order", email="o@test.com", name="O", credits=5, plan="pro",
                stripe_customer_id="cus_order", stripe_subscription_id="sub_order")
    await _seed(client_factory, user)
    async with client_factory(user) as client:
        deleted = {"type": "customer.subscription.deleted", "data": {"object": _sub("sub_order", "canceled", customer="cus_order")}}
        await _post_webhook(client, deleted)
        late = {"type": "customer.subscription.updated", "data": {"object": _sub("sub_order", "active", customer="cus_order")}}
        _, mock_client = await _post_webhook(client, late, current=_sub("sub_order", "canceled", customer="cus_order"))
    mock_client.v1.subscriptions.retrieve.assert_called_with("sub_order")
    db_user = await _plan_of("u_order")
    assert db_user.plan == "free" and db_user.stripe_subscription_id is None


@pytest.mark.asyncio
async def test_past_due_keeps_pro_while_stripe_retries_and_unpaid_ends_it(client_factory, stripe_enabled):
    user = User(id="u_due", email="d@test.com", name="D", credits=5, plan="pro",
                stripe_customer_id="cus_due", stripe_subscription_id="sub_due")
    await _seed(client_factory, user)
    async with client_factory(user) as client:
        await _post_webhook(client, {"type": "customer.subscription.updated", "data": {"object": _sub("sub_due", "past_due", customer="cus_due")}})
        assert (await _plan_of("u_due")).plan == "pro"
        await _post_webhook(client, {"type": "customer.subscription.updated", "data": {"object": _sub("sub_due", "unpaid", customer="cus_due")}})
    assert (await _plan_of("u_due")).plan == "free"


@pytest.mark.asyncio
async def test_a_paused_trial_drops_to_free(client_factory, stripe_enabled):
    user = User(id="u_pause", email="p@test.com", name="P", credits=5, plan="pro",
                stripe_customer_id="cus_pause", stripe_subscription_id="sub_pause")
    await _seed(client_factory, user)
    async with client_factory(user) as client:
        await _post_webhook(client, {"type": "customer.subscription.updated", "data": {"object": _sub("sub_pause", "paused", customer="cus_pause")}})
    assert (await _plan_of("u_pause")).plan == "free"


@pytest.mark.asyncio
async def test_webhook_missing_signature_rejected(client_factory, stripe_enabled):
    user = User(id="u_bill9", email="b9@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        res = await client.post("/api/webhooks/stripe", content=b"{}")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_webhook_bad_signature_rejected(client_factory, stripe_enabled):
    import stripe as stripe_sdk

    user = User(id="u_bill10", email="b10@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        with patch(
            "stripe.Webhook.construct_event",
            side_effect=stripe_sdk.SignatureVerificationError("bad sig", "sig_header"),
        ):
            res = await client.post(
                "/api/webhooks/stripe",
                content=b"{}",
                headers={"stripe-signature": "t=1,v1=bad"},
            )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_tiers_reflect_stripe_enabled_flag(client_factory, stripe_enabled):
    user = User(id="u_bill11", email="b11@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        res = await client.get("/api/tiers")
    tiers = {t["slug"]: t for t in res.json()["tiers"]}
    assert tiers["pro"]["available"] is True
    assert tiers["pro"]["cta"] == "Upgrade to Pro"


@pytest.mark.asyncio
async def test_tiers_show_coming_soon_when_disabled(client_factory):
    user = User(id="u_bill12", email="b12@test.com", name="B", credits=5)
    async with client_factory(user) as client:
        res = await client.get("/api/tiers")
    tiers = {t["slug"]: t for t in res.json()["tiers"]}
    assert tiers["pro"]["available"] is False
    assert tiers["pro"]["cta"] == "Coming soon"
