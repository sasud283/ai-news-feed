"""Real PostgreSQL checks of private membership and durable send state."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx

from src.newsletter import worker


async def member(pg, kind="complimentary"):
    return (
        await pg.fetch(
            """INSERT INTO newsletter_members(email,cadence,access_kind,comp_reason,status)
        VALUES('test@example.com','daily',$1,'Test','active') RETURNING id""",
            kind,
        )
    )[0]["id"]


async def test_membership_is_private_and_browser_cannot_grant_access(pg):
    await member(pg)
    await pg.execute("SET ROLE anon")
    with pytest.raises(RuntimeError, match="permission denied"):
        await pg.fetch("SELECT * FROM newsletter_members")
    with pytest.raises(RuntimeError, match="permission denied"):
        await pg.execute(
            "INSERT INTO digest_subscribers(email) VALUES('abuse@example.com')"
        )
    await pg.execute("RESET ROLE")


async def test_comp_creation_is_idempotent_and_requires_reason(pg):
    await member(pg)
    with pytest.raises(RuntimeError, match="unique"):
        await member(pg)
    with pytest.raises(RuntimeError, match="check constraint"):
        await pg.execute(
            "INSERT INTO newsletter_members(email,cadence,access_kind) VALUES('x@example.com','weekly','complimentary')"
        )


@respx.mock
async def test_send_retry_reuses_payload_and_key(pg, monkeypatch):
    member_id = await member(pg)
    now = datetime.now(UTC)
    due = now - timedelta(minutes=1)
    await pg.execute(
        "UPDATE newsletter_members SET next_send_at=$2 WHERE id=$1", member_id, due
    )
    payload = {
        "from": "test@example.com",
        "to": ["test@example.com"],
        "subject": "Test",
        "text": "Digest",
    }
    await pg.execute(
        "INSERT INTO newsletter_deliveries(member_id,due_at,payload) VALUES($1,$2,$3::jsonb)",
        member_id,
        due,
        json.dumps(payload),
    )
    row = dict(
        (await pg.fetch("SELECT * FROM newsletter_members WHERE id=$1", member_id))[0]
    )
    row["next_send_at"] = due

    async def refresh(db, client, old):
        return row

    monkeypatch.setattr(worker, "refresh_member", refresh)
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    calls = []

    def respond(request):
        calls.append((request.headers["Idempotency-Key"], json.loads(request.content)))
        if len(calls) == 1:
            raise httpx.ReadTimeout("uncertain", request=request)
        return httpx.Response(200, json={"id": "email_1"})

    route = respx.post("https://api.resend.com/emails").mock(side_effect=respond)
    # The bridge returns date strings outside published_at; adapt to asyncpg.
    original = pg.fetch

    async def fetch(sql, *args, **kwargs):
        rows = await original(sql, *args, **kwargs)
        for r in rows:
            for key in ("due_at", "attempted_at", "accepted_at", "created_at"):
                if isinstance(r.get(key), str):
                    r[key] = datetime.fromisoformat(r[key])
        return rows

    monkeypatch.setattr(pg, "fetch", fetch)
    async with httpx.AsyncClient() as client:
        with pytest.raises(httpx.ReadTimeout):
            await worker.deliver(pg, client, row)
        await worker.deliver(pg, client, row)
        await worker.deliver(pg, client, row)
    assert route.call_count == 2
    assert calls[0] == calls[1]
    assert (
        await pg.fetchval(
            "SELECT count(*) FROM newsletter_deliveries WHERE accepted_at IS NOT NULL"
        )
        == 1
    )


@respx.mock
async def test_unsubscribed_and_expired_never_call_resend(pg):
    now = datetime.now(UTC)
    base = {
        "id": "00000000-0000-0000-0000-000000000001",
        "access_kind": "paid",
        "status": "active",
        "unsubscribed": False,
        "paid_until": now - timedelta(seconds=1),
        "verified_at": now,
        "next_send_at": now,
    }
    async with httpx.AsyncClient() as client:
        await worker.deliver(pg, client, base)
        base.update(paid_until=now + timedelta(days=1), unsubscribed=True)
        await worker.deliver(pg, client, base)
    assert len(respx.calls) == 0


async def test_provision_keeps_existing_unsubscribe(pg, monkeypatch):
    from src.newsletter.provision import provision

    async def connect(*args, **kwargs):
        return pg

    monkeypatch.setenv("DATABASE_URL", "unused")
    monkeypatch.setattr("src.newsletter.provision.asyncpg.connect", connect)
    await provision("Owner@example.com", "weekly", "Owner-approved test")
    await pg.execute("UPDATE newsletter_members SET unsubscribed=true")
    await provision("owner@example.com", "weekly", "Owner-approved test")
    assert await pg.fetchval("SELECT count(*) FROM newsletter_members") == 1
    assert await pg.fetchval("SELECT unsubscribed FROM newsletter_members") is True


async def test_refresh_stores_payment_failure_without_extending_access(pg, monkeypatch):
    member_id = (
        await pg.fetch(
            """INSERT INTO newsletter_members(email,cadence,access_kind,stripe_subscription_id)
        VALUES('paid@example.com','weekly','paid','sub_test') RETURNING id"""
        )
    )[0]["id"]
    row = dict(
        (await pg.fetch("SELECT * FROM newsletter_members WHERE id=$1", member_id))[0]
    )
    expired = datetime.now(UTC) - timedelta(days=1)

    async def state(client, subscription):
        return {"status": "past_due", "paid_until": expired, "customer": "cus_test"}

    monkeypatch.setattr(worker, "payment_state", state)
    async with httpx.AsyncClient() as client:
        refreshed = await worker.refresh_member(pg, client, row)
    assert refreshed["status"] == "past_due"
    assert refreshed["verified_at"] is not None


@respx.mock
async def test_completed_checkout_recovery_is_idempotent(pg, monkeypatch):
    checkout = (
        await pg.fetch(
            """INSERT INTO newsletter_checkouts(email,cadence,plan,stripe_session_id)
        VALUES('new@example.com','weekly','monthly','cs_test') RETURNING id"""
        )
    )[0]["id"]

    async def stripe(client, path):
        return {
            "status": "complete",
            "payment_status": "paid",
            "client_reference_id": checkout,
            "subscription": "sub_new",
            "customer": "cus_new",
            "created": 1800000000,
        }

    monkeypatch.setattr(worker, "stripe_get", stripe)
    async with httpx.AsyncClient() as client:
        assert await worker.reconcile_checkouts(pg, client) is False
        assert await worker.reconcile_checkouts(pg, client) is False
    assert await pg.fetchval("SELECT count(*) FROM newsletter_members") == 1
    # Recovery creates pending state, not paid access based on a redirect.
    assert await pg.fetchval("SELECT status FROM newsletter_members") == "pending"


async def test_digest_only_contains_published_matching_topics_and_escapes_html(
    pg, monkeypatch
):
    await pg.execute("UPDATE stories SET publication_status='review'")
    member_id = await member(pg)
    for headline, status in [
        ("<b>Public test</b>", "published"),
        ("Private secret", "review"),
    ]:
        story = (
            await pg.fetch(
                """INSERT INTO stories(headline,ai_generated_summary,publication_status,published_at)
            VALUES($1,'A safe summary',$2,now()) RETURNING id""",
                headline,
                status,
            )
        )[0]["id"]
        await pg.execute(
            "INSERT INTO story_topics(story_id,topic) VALUES($1,'Models & Research')",
            story,
        )
    row = dict(
        (await pg.fetch("SELECT * FROM newsletter_members WHERE id=$1", member_id))[0]
    )
    row["topics"] = ["Models & Research"]
    for key, value in {
        "NEWSLETTER_SITE_URL": "https://example.com",
        "NEWSLETTER_LINK_SECRET": "test-secret",
        "NEWSLETTER_FROM": "test@example.com",
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("NEWSLETTER_POSTAL_ADDRESS", raising=False)
    payload = await worker.compose(pg, row)
    assert "&lt;b&gt;Public test&lt;/b&gt;" in payload["html"]
    assert "Private secret" not in payload["html"]
    assert "<b>Public test</b>" not in payload["html"]
    assert payload["headers"]["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    row["topics"] = ["National Initiatives"]
    empty = await worker.compose(pg, row)
    assert "Public test" not in empty["html"]
    assert "No new reviewed stories" in empty["html"]
