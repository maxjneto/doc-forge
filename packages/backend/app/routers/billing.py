from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import billing as billing_service

router = APIRouter(tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str = Field(pattern=r"^(pro|team)$")


class CheckoutResponse(BaseModel):
    url: str


@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(
    payload: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a Stripe Checkout session to subscribe to Pro or Team."""
    url = await billing_service.create_checkout_session(db, current_user, payload.plan)
    return CheckoutResponse(url=url)


@router.post("/billing/portal", response_model=CheckoutResponse)
async def create_portal(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Redirect to the Stripe Customer Portal to manage or cancel a subscription."""
    url = await billing_service.create_portal_session(db, current_user)
    return CheckoutResponse(url=url)


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe webhook endpoint — no auth (Stripe signs the payload instead).

    Configure in the Stripe dashboard to point here, subscribed to at least:
    checkout.session.completed, customer.subscription.updated,
    customer.subscription.deleted.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
    try:
        await billing_service.handle_webhook_event(db, payload, sig_header)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[billing] webhook processing failed: {}", e)
        raise HTTPException(status_code=500, detail="Webhook processing failed")
    return {"status": "ok"}
