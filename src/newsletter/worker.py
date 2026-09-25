"""Reconcile billing and deliver due digests on the configured schedule."""

import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import asyncpg
import httpx

from src.newsletter.logging import logger
from src.newsletter.models import eligible, next_send, subscriber_token
from src.newsletter.providers import payment_state, stripe_get
from src.newsletter.template import render_digest


def utcnow() -> datetime:
    """Return the current timezone-aware UTC timestamp."""
    return datetime.now(UTC)


async def reconcile_checkouts(
    db: asyncpg.Connection, client: httpx.AsyncClient
) -> bool:
    """Recover completed checkouts, including missed webhooks.

    Args:
        db: Database connection.
        client: Shared HTTP client.
    """
    rows = await db.fetch(
        "SELECT * FROM newsletter_checkouts WHERE NOT completed AND stripe_session_id IS NOT NULL"
    )
    failed = False
    for row in rows:
        try:
            session = await stripe_get(
                client, f"checkout/sessions/{row['stripe_session_id']}"
            )
            if session["status"] == "expired":
                await db.execute(
                    "UPDATE newsletter_checkouts SET completed=true WHERE id=$1",
                    row["id"],
                )
                continue
            if (
                session["status"] != "complete"
                or session.get("payment_status") != "paid"
            ):
                continue
            if session.get("client_reference_id") != str(row["id"]) or not session.get(
                "subscription"
            ):
                raise ValueError("Checkout reference mismatch")
            async with db.transaction():
                await db.execute(
                    """
                    INSERT INTO newsletter_members(email,cadence,topics,access_kind,
                        stripe_subscription_id,stripe_customer_id,first_due_at)
                    VALUES($1,$2,$3,'paid',$4,$5,to_timestamp($6))
                    ON CONFLICT(stripe_subscription_id) DO NOTHING
                """,
                    row["email"],
                    row["cadence"],
                    row["topics"],
                    session["subscription"],
                    session["customer"],
                    session.get("created"),
                )
                await db.execute(
                    "UPDATE newsletter_checkouts SET completed=true WHERE id=$1",
                    row["id"],
                )
        except (httpx.HTTPError, ValueError, KeyError):
            failed = True
            logger.error(
                "newsletter_checkout_sync_failed", extra={"checkout_id": str(row["id"])}
            )

    return failed


async def refresh_member(
    db: asyncpg.Connection, client: httpx.AsyncClient, member: dict
) -> dict:
    """Refresh a paying reader from Stripe, failing closed on provider errors.

    Args:
        db: Database connection.
        client: Shared HTTP client.
        member: Current member row.

    Returns:
        Refreshed local member. Exceptions stop sending to this member.
    """
    if member["access_kind"] == "paid":
        state = await payment_state(client, member["stripe_subscription_id"])
        await db.execute(
            """UPDATE newsletter_members SET status=$2,paid_until=$3,
            stripe_customer_id=$4,verified_at=$5 WHERE id=$1""",
            member["id"],
            state["status"],
            state["paid_until"],
            state["customer"],
            utcnow(),
        )
    return dict(
        (await db.fetch("SELECT * FROM newsletter_members WHERE id=$1", member["id"]))[
            0
        ]
    )


async def compose(db: asyncpg.Connection, member: dict) -> dict:
    """Render a digest from published summaries, escaped and source-linked.

    Args:
        db: Database connection.
        member: Subscriber cadence and topic preferences.

    Returns:
        Immutable Resend request payload. An empty edition still welcomes new readers.
    """
    friday_roundup = utcnow().astimezone(ZoneInfo("Europe/Malta")).weekday() == 4
    since = utcnow() - timedelta(
        days=(
            7
            if member["cadence"] == "weekly"
            or not member["first_sent_at"]
            or friday_roundup
            else 1
        )
    )
    stories = await db.fetch(
        """
        SELECT s.headline,s.ai_generated_summary,s.published_at,s.content_type,
            source.source_name,source.source_url AS url
        FROM stories s
        LEFT JOIN LATERAL (
            SELECT source_name,source_url FROM story_sources
            WHERE story_id=s.id ORDER BY id LIMIT 1
        ) source ON true
        WHERE s.publication_status='published' AND s.published_at >= $1
        AND (cardinality($2::text[])=0 OR EXISTS (
            SELECT 1 FROM story_topics t WHERE t.story_id=s.id AND t.topic::text=ANY($2::text[])))
        ORDER BY s.published_at DESC LIMIT 30
    """,
        since,
        member["topics"],
    )
    base = os.environ["NEWSLETTER_SITE_URL"].rstrip("/")
    token = subscriber_token(str(member["id"]), os.environ["NEWSLETTER_LINK_SECRET"])
    manage = f"{base}/api/newsletter/manage?id={member['id']}&token={token}"
    address = os.environ.get("NEWSLETTER_POSTAL_ADDRESS", "")
    if not address and member["access_kind"] != "complimentary":
        raise ValueError("Public newsletter footer is not configured")
    if not address:
        address = "Private test edition — not a public subscription."
    subject, html_body, text_body = render_digest(
        [dict(story) for story in stories],
        cadence=member["cadence"],
        issued_at=utcnow(),
        first_edition=not member["first_sent_at"],
        site_url=base,
        manage_url=manage,
        postal_address=address,
    )
    return {
        "reply_to": os.environ.get("NEWSLETTER_REPLY_TO", "thefullpictureai@gmail.com"),
        "from": os.environ["NEWSLETTER_FROM"],
        "to": [member["email"]],
        "subject": subject,
        "html": html_body,
        "text": text_body,
        "headers": {
            "List-Unsubscribe": f'<{base}/api/newsletter/unsubscribe?id={member["id"]}&token={token}>',
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    }


async def deliver(
    db: asyncpg.Connection, client: httpx.AsyncClient, member: dict
) -> None:
    """Send an eligible digest once, using a persistent payload and idempotency key.

    Args:
        db: Database connection, with the worker advisory lock held.
        client: Shared HTTP client.
        member: Fresh subscription record.
    """
    now = utcnow()
    if not eligible(member, now) or member["next_send_at"] > now:
        return
    rows = await db.fetch(
        "SELECT * FROM newsletter_deliveries WHERE member_id=$1 AND due_at=$2",
        member["id"],
        member["next_send_at"],
    )
    if not rows:
        payload = await compose(db, member)
        rows = await db.fetch(
            """INSERT INTO newsletter_deliveries(member_id,due_at,payload)
            VALUES($1,$2,$3::jsonb) ON CONFLICT(member_id,due_at) DO UPDATE SET due_at=excluded.due_at RETURNING *""",
            member["id"],
            member["next_send_at"],
            json.dumps(payload),
        )
    delivery = dict(rows[0])
    if delivery["accepted_at"]:
        return
    # Resend retains idempotency keys for 24h. An ambiguous attempt older than
    # 23h needs operator reconciliation, never a blind potentially duplicate retry.
    if delivery["attempted_at"] and now - delivery["attempted_at"] >= timedelta(
        hours=23
    ):
        raise ValueError("Ambiguous delivery requires manual reconciliation")
    member = await refresh_member(db, client, member)
    if not eligible(member, utcnow()):
        return
    await db.execute(
        "UPDATE newsletter_deliveries SET attempted_at=coalesce(attempted_at,$2) WHERE id=$1",
        delivery["id"],
        now,
    )
    payload = delivery["payload"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    response = await client.post(
        "https://api.resend.com/emails",
        json=payload,
        headers={
            "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
            "Idempotency-Key": f"digest/{delivery['id']}",
        },
    )
    response.raise_for_status()
    provider_id = response.json()["id"]
    async with db.transaction():
        await db.execute(
            "UPDATE newsletter_deliveries SET accepted_at=$2,provider_id=$3,delivery_status='accepted' WHERE id=$1",
            delivery["id"],
            utcnow(),
            provider_id,
        )
        await db.execute(
            "UPDATE newsletter_members SET first_sent_at=coalesce(first_sent_at,$2),next_send_at=$3 WHERE id=$1",
            member["id"],
            utcnow(),
            next_send(member["cadence"], utcnow()),
        )
    logger.info(
        "newsletter_accepted",
        extra={"member_id": str(member["id"]), "delivery_id": str(delivery["id"])},
    )


async def track_delivery(db: asyncpg.Connection, client: httpx.AsyncClient) -> None:
    """Check provider delivery outcomes and flag bounces or delivery delays.

    Args:
        db: Database connection.
        client: Shared HTTP client.
    """
    rows = await db.fetch(
        "SELECT * FROM newsletter_deliveries WHERE provider_id IS NOT NULL AND delivery_status IN ('accepted','sent','delivery_delayed','queued','scheduled')"
    )
    for row in rows:
        response = await client.get(
            f"https://api.resend.com/emails/{row['provider_id']}",
            headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
        )
        response.raise_for_status()
        status = response.json().get("last_event", "accepted")
        await db.execute(
            "UPDATE newsletter_deliveries SET delivery_status=$2 WHERE id=$1",
            row["id"],
            status,
        )
        if status in ("bounced", "complained", "failed", "suppressed"):
            await db.execute(
                "UPDATE newsletter_members SET unsubscribed=true WHERE id=$1",
                row["member_id"],
            )
            logger.error(
                "newsletter_delivery_failed", extra={"delivery_id": str(row["id"])}
            )
            raise ValueError("Newsletter delivery failure requires review")
        if status not in ("delivered", "opened", "clicked") and utcnow() - row[
            "accepted_at"
        ] > timedelta(hours=22):
            raise ValueError("Newsletter delivery overdue")


async def run() -> None:
    """Run one locked billing reconciliation and digest delivery pass.

    Raises:
        ValueError: Configuration is missing or a delivery needs attention.
    """
    required = (
        "DATABASE_URL",
        "RESEND_API_KEY",
        "NEWSLETTER_FROM",
        "NEWSLETTER_SITE_URL",
        "NEWSLETTER_LINK_SECRET",
    )
    if os.environ.get("NEWSLETTER_SEND_ENABLED") != "true":
        raise ValueError("Newsletter sending is disabled")
    if any(not os.environ.get(key) for key in required):
        raise ValueError("Newsletter configuration incomplete")
    if (
        not os.environ.get("NEWSLETTER_POSTAL_ADDRESS")
        and os.environ.get("NEWSLETTER_TEST_ONLY") != "true"
    ):
        raise ValueError("Public newsletter footer is not configured")
    db = await asyncpg.connect(
        os.environ["DATABASE_URL"], statement_cache_size=0, timeout=20
    )
    try:
        if not await db.fetchval("SELECT pg_try_advisory_lock(746320914)"):
            return

        async def pace(response: httpx.Response) -> None:
            # Keep below Resend's default two requests/second account limit.
            await asyncio.sleep(0.6)

        async with httpx.AsyncClient(
            timeout=30, event_hooks={"response": [pace]}
        ) as client:
            test_only = os.environ.get("NEWSLETTER_TEST_ONLY") == "true"
            failed = False if test_only else await reconcile_checkouts(db, client)
            rows = await db.fetch(
                "SELECT * FROM newsletter_members WHERE NOT unsubscribed ORDER BY next_send_at"
            )
            for row in rows:
                if test_only and row["access_kind"] != "complimentary":
                    continue
                try:
                    member = await refresh_member(db, client, dict(row))
                    await deliver(db, client, member)
                except (httpx.HTTPError, ValueError, KeyError):
                    failed = True
                    logger.error(
                        "newsletter_member_failed", extra={"member_id": str(row["id"])}
                    )
            await track_delivery(db, client)
            overdue = await db.fetchval(
                """SELECT count(*) FROM newsletter_members
                WHERE NOT unsubscribed AND first_sent_at IS NULL
                AND first_due_at < now()-interval '22 hours'
                AND ((access_kind='complimentary' AND status='active') OR paid_until > now())
                AND ($1::boolean=false OR access_kind='complimentary')""",
                test_only,
            )
            if failed or overdue:
                raise ValueError("Newsletter worker needs attention")
    finally:
        await db.close()


def main() -> None:
    """Run the worker and emit safe structured failure logs."""
    try:
        asyncio.run(run())
    except (
        ValueError,
        KeyError,
        OSError,
        httpx.HTTPError,
        asyncpg.PostgresError,
    ) as exc:
        logger.error(
            "newsletter_worker_failed", extra={"error_type": type(exc).__name__}
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
