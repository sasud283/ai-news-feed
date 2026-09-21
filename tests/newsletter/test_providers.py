"""Stripe payment verification, including refunds and unpaid renewals."""

from datetime import UTC, datetime

import httpx
import pytest
import respx

from src.newsletter.providers import payment_state


@respx.mock
@pytest.mark.parametrize(
    "refunded,disputed,paid_out_of_band,expected",
    [
        (False, False, False, True),
        (True, False, False, False),
        (False, True, False, False),
        (False, False, True, False),
    ],
)
async def test_paid_invoice_is_required(
    monkeypatch, refunded, disputed, paid_out_of_band, expected
):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")
    respx.get("https://api.stripe.com/v1/subscriptions/sub_1").mock(
        return_value=httpx.Response(
            200, json={"status": "past_due", "customer": "cus_1", "livemode": False}
        )
    )
    respx.get("https://api.stripe.com/v1/invoices").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "paid": True,
                        "amount_paid": 300,
                        "paid_out_of_band": paid_out_of_band,
                        "payment_intent": "pi_1",
                        "lines": {
                            "data": [
                                {
                                    "type": "subscription",
                                    "subscription": "sub_1",
                                    "proration": False,
                                    "period": {"end": 1800000000},
                                }
                            ]
                        },
                    }
                ]
            },
        )
    )
    respx.get("https://api.stripe.com/v1/payment_intents/pi_1").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "succeeded",
                "latest_charge": {"refunded": refunded, "disputed": disputed},
            },
        )
    )
    async with httpx.AsyncClient() as client:
        state = await payment_state(client, "sub_1")
    assert state["status"] == "past_due"
    assert state["paid_until"] == (
        datetime.fromtimestamp(1800000000, UTC) if expected else None
    )
