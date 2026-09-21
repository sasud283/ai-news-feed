"""Payment boundary and scheduling regression tests."""

from datetime import UTC, datetime, timedelta

import pytest

from src.newsletter.models import eligible, next_send, subscriber_token

NOW = datetime(2026, 9, 20, 12, tzinfo=UTC)


@pytest.fixture
def paid():
    return {
        "unsubscribed": False,
        "access_kind": "paid",
        "status": "active",
        "paid_until": NOW + timedelta(days=1),
        "verified_at": NOW,
        "comp_reason": None,
    }


def test_paid_access_expires_at_boundary(paid):
    assert eligible(paid, NOW)
    paid["paid_until"] = NOW
    assert not eligible(paid, NOW)


@pytest.mark.parametrize(
    "status", ["pending", "trialing", "unpaid", "canceled", "paused", "incomplete"]
)
def test_unpaid_states_never_send(paid, status):
    paid["status"] = status
    assert not eligible(paid, NOW)


def test_failed_renewal_only_keeps_already_paid_time(paid):
    paid["status"] = "past_due"
    assert eligible(paid, NOW)
    paid["paid_until"] = NOW - timedelta(seconds=1)
    assert not eligible(paid, NOW)


def test_stale_verification_and_unsubscribe_block_sends(paid):
    paid["verified_at"] = NOW - timedelta(minutes=21)
    assert not eligible(paid, NOW)
    paid["verified_at"] = NOW
    paid["unsubscribed"] = True
    assert not eligible(paid, NOW)


def test_comp_requires_explicit_reason(paid):
    paid.update(access_kind="complimentary", paid_until=None, verified_at=None)
    assert not eligible(paid, NOW)
    paid["comp_reason"] = "Owner-approved testing"
    assert eligible(paid, NOW)


def test_weekly_and_daily_skip_to_correct_day():
    assert next_send("daily", NOW).isoformat() == "2026-09-21T07:00:00+02:00"
    assert next_send("weekly", NOW).isoformat() == "2026-09-25T07:00:00+02:00"


def test_schedule_handles_dst():
    now = datetime(2026, 10, 23, 8, tzinfo=UTC)
    assert next_send("weekly", now).isoformat() == "2026-10-30T07:00:00+01:00"


def test_tokens_are_stable_and_bound_to_member():
    assert subscriber_token("a", "secret") == subscriber_token("a", "secret")
    assert subscriber_token("a", "secret") != subscriber_token("b", "secret")
