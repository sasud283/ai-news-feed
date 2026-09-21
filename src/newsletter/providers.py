"""Small asynchronous Stripe and Resend clients; never log provider bodies."""

import os
from datetime import UTC, datetime

import httpx

STRIPE_VERSION = "2024-06-20"


async def stripe_get(
    client: httpx.AsyncClient, path: str, params: dict[str, str | int] | None = None
) -> dict:
    """Retrieve Stripe state with a pinned response schema.

    Args:
        client: Shared HTTP client.
        path: Stripe API path controlled by the application.
        params: Optional query parameters.

    Returns:
        Verified server-side API response.
    """
    response = await client.get(
        f"https://api.stripe.com/v1/{path}",
        params=params,
        headers={
            "Authorization": f"Bearer {os.environ['STRIPE_SECRET_KEY']}",
            "Stripe-Version": STRIPE_VERSION,
        },
    )
    response.raise_for_status()
    return response.json()


async def payment_state(client: httpx.AsyncClient, subscription_id: str) -> dict:
    """Compute entitlement from the subscription's latest actually paid invoice.

    Args:
        client: Shared client.
        subscription_id: Server-stored Stripe subscription ID.

    Returns:
        Subscription status, customer, and paid-through time; never trial access.
    """
    sub = await stripe_get(client, f"subscriptions/{subscription_id}")
    if sub.get("livemode") is not (os.environ.get("NEWSLETTER_STRIPE_LIVE") == "true"):
        raise ValueError("Stripe live/test mode mismatch")
    invoices = await stripe_get(
        client,
        "invoices",
        {"subscription": subscription_id, "status": "paid", "limit": 100},
    )
    paid_until = None
    for invoice in invoices["data"]:
        # A zero-price, out-of-band or credited invoice is not proof of payment.
        if (
            not invoice.get("paid")
            or invoice.get("amount_paid", 0) <= 0
            or invoice.get("paid_out_of_band")
        ):
            continue
        payment_id = invoice.get("payment_intent")
        if not payment_id:
            continue
        payment = await stripe_get(
            client, f"payment_intents/{payment_id}", {"expand[]": "latest_charge"}
        )
        charge = payment.get("latest_charge") or {}
        if (
            payment.get("status") != "succeeded"
            or charge.get("refunded")
            or charge.get("disputed")
        ):
            continue
        lines = invoice["lines"]["data"]
        if invoice["lines"].get("has_more"):
            raise ValueError(
                "Unexpected multi-page invoice; review billing configuration"
            )
        for line in lines:
            if line.get("type") != "subscription" or line.get("proration"):
                continue
            if line.get("subscription") != subscription_id:
                continue
            until = datetime.fromtimestamp(line["period"]["end"], UTC)
            paid_until = max(paid_until, until) if paid_until else until
    # Invoices are newest first; fixed recurring plans cannot need older access
    # periods than the 100 most recent invoices. No unpaid invoice extends access.
    return {
        "status": sub["status"],
        "paid_until": paid_until,
        "customer": sub["customer"],
    }
