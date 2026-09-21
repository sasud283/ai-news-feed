"""Newsletter access, cadence and signed subscriber links."""

import hashlib
import hmac
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def eligible(member: dict, now: datetime) -> bool:
    """Check entitlement immediately before a send.

    Args:
        member: Current, server-owned subscription record.
        now: A timezone-aware current time.

    Returns:
        Whether the reader has current paid or explicit complimentary access.
    """
    if member["unsubscribed"]:
        return False
    if member["access_kind"] == "complimentary":
        return member["status"] == "active" and bool(member["comp_reason"])
    return (
        member["status"] in ("active", "past_due")
        and member["paid_until"] is not None
        and member["paid_until"] > now
        and member["verified_at"] is not None
        and now - member["verified_at"] < timedelta(minutes=20)
    )


def next_send(cadence: str, now: datetime) -> datetime:
    """Return the next weekday daily or Friday weekly send at 07:00 Malta time.

    Args:
        cadence: Daily or weekly delivery.
        now: Current timezone-aware time, after a successful initial or routine send.

    Returns:
        Next scheduled time, respecting daylight saving time.
    """
    if cadence not in ("daily", "weekly"):
        raise ValueError("Unknown cadence")
    local = now.astimezone(ZoneInfo("Europe/Malta"))
    target = local.replace(hour=7, minute=0, second=0, microsecond=0)
    while target <= local or (
        target.weekday() != 4 if cadence == "weekly" else target.weekday() > 4
    ):
        target += timedelta(days=1)
    return target


def subscriber_token(member_id: str, secret: str) -> str:
    """Create a purpose-bound subscriber management token.

    Args:
        member_id: Random internal member identifier.
        secret: Server-only signing secret shared with the website.

    Returns:
        HMAC token for this member's management links.
    """
    return hmac.new(
        secret.encode(), f"newsletter:{member_id}".encode(), hashlib.sha256
    ).hexdigest()
