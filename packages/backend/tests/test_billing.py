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
        with patch("stripe.Webhook.construct_event", return_value=fake_event):
            res = await client.post(
                "/api/webhooks/stripe",
                content=b"{}",
                headers={"stripe-signature": "t=1,v1=fake"},
            )
    assert res.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill8"))
        db_user = result.scalar_one()
        assert db_user.plan == "free"
        assert db_user.stripe_subscription_id is None


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
        with patch("stripe.Webhook.construct_event", return_value=fake_event):
            res = await client.post(
                "/api/webhooks/stripe",
                content=b"{}",
                headers={"stripe-signature": "t=1,v1=fake"},
            )
    assert res.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == "u_bill13"))
        db_user = result.scalar_one()
        assert db_user.plan == "pro"
        assert db_user.stripe_subscription_id == "sub_current"


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
