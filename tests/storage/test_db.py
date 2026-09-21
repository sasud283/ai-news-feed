"""Persistent deduplication, atomic writes, review publication and retries."""

import json
from dataclasses import replace
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from src.ingestion.rss_poller import FeedItem
from src.processing.models import (
    Classification,
    ProcessedStory,
    ProcessingFailure,
    ProcessingResult,
    SourceUpdate,
    StorySource,
)
from src.storage.db import load_history, process_and_store, save_result
from src.storage.models import WorkerBusyError

URL = "https://news.example/ai-model"
DATE = datetime(2026, 9, 18, 10, tzinfo=UTC)
ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def story(**kwargs):
    value = ProcessedStory(
        "OpenAI releases a new AI research model",
        URL,
        DATE,
        "An AI-generated summary.",
        Classification(
            True,
            ("Models & Research",),
            "Useful",
            "Worldwide",
            (0.95,),
            0.95,
            0.95,
            0.95,
            False,
        ),
        (StorySource("News", URL, "Free"),),
        "Article",
        "Free",
        (),
    )
    return replace(value, **kwargs)


def result(**kwargs):
    return replace(ProcessingResult((), (), (), (), (), ()), **kwargs)


async def store(pg, value):
    async with pg.transaction():
        await save_result(pg, value)


async def login(pg, identity):
    await pg.execute("RESET ROLE")
    await pg.fetch(
        "INSERT INTO auth.users(id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        ADMIN,
        "admin@example.test",
    )
    await pg.fetch(
        "INSERT INTO auth.users(id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        USER,
        "user@example.test",
    )
    await pg.execute(
        "INSERT INTO public.user_roles(user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
        ADMIN,
    )
    await pg.execute("SELECT set_config('request.jwt.claim.sub', $1, false)", identity)
    await pg.execute("SET ROLE authenticated")


async def test_roundtrip_preserves_unknowns_and_no_excerpts(pg):
    await store(
        pg,
        result(
            stories=(
                story(
                    published_at=None,
                    access=None,
                    sources=(StorySource("News", URL),),
                    review_reasons=("unknown_access",),
                ),
            )
        ),
    )
    row = (await pg.fetch("SELECT * FROM public.stories WHERE canonical_url=$1", URL))[
        0
    ]
    assert row["publication_status"] == "review"
    assert row["published_at"] is None
    assert (
        await pg.fetchval(
            "SELECT access FROM public.story_tags WHERE story_id=$1", row["id"]
        )
        is None
    )
    assert (
        await pg.fetchval(
            "SELECT is_paywalled FROM public.story_sources WHERE story_id=$1", row["id"]
        )
        is None
    )
    assert (
        await pg.fetchval(
            "SELECT count(*) FROM public.spot_check_queue WHERE story_id=$1", row["id"]
        )
        == 1
    )
    assert "raw_summary" not in str(row)


async def test_repeat_run_skips_model_and_retains_editor_changes(
    connected, monkeypatch
):
    await store(connected, result(stories=(story(),)))
    await connected.execute(
        "UPDATE public.stories SET ai_generated_summary='Editor text' WHERE canonical_url=$1",
        URL,
    )
    model = AsyncMock(side_effect=AssertionError("Model must not run"))
    monkeypatch.setattr("src.processing.pipeline.summarise_story", model)
    item = FeedItem(
        story().headline, URL + "?utm_source=rss", DATE, "News", "", "PRIVATE EXCERPT"
    )
    output = await process_and_store([item], database_url="test", content_types={})
    assert output.skipped_urls == (URL,)
    model.assert_not_awaited()
    await store(connected, result(stories=(story(),)))
    assert (
        await connected.fetchval(
            "SELECT ai_generated_summary FROM public.stories WHERE canonical_url=$1",
            URL,
        )
        == "Editor text"
    )
    assert "PRIVATE EXCERPT" not in str(connected.queries)


async def test_additional_source_requeues_without_model(connected, monkeypatch):
    await store(connected, result(stories=(story(),)))
    model = AsyncMock(side_effect=AssertionError("Model must not run"))
    monkeypatch.setattr("src.processing.pipeline.summarise_story", model)
    item = FeedItem(
        story().headline, "https://other.example/story", DATE, "Other", "", "Transient"
    )
    output = await process_and_store([item], database_url="test", content_types={})
    assert len(output.source_updates) == 1
    assert (
        await connected.fetchval(
            "SELECT publication_status FROM public.stories WHERE canonical_url=$1", URL
        )
        == "review"
    )
    assert (
        await connected.fetchval(
            "SELECT count(*) FROM public.ingestion_urls WHERE status='stored'"
        )
        == 2
    )
    model.assert_not_awaited()


async def test_retryable_failures_and_deferred_but_rejections_seen(pg):
    await store(
        pg,
        result(
            rejected_urls=(URL,),
            deferred_urls=("https://example.test/deferred",),
            failures=(ProcessingFailure(("https://example.test/failed",), "APIError"),),
        ),
    )
    items = [
        FeedItem("Title", url, DATE, "News", "", "")
        for url in (URL, "https://example.test/deferred", "https://example.test/failed")
    ]
    history = await load_history(pg, items)
    assert history.seen_urls == {URL}
    await store(
        pg,
        result(
            stories=(
                story(
                    url="https://example.test/failed",
                    sources=(
                        StorySource("News", "https://example.test/failed", "Free"),
                    ),
                ),
            )
        ),
    )
    assert (
        await pg.fetchval(
            "SELECT status FROM public.ingestion_urls WHERE url=$1",
            "https://example.test/failed",
        )
        == "stored"
    )


async def test_transaction_rolls_back_partial_batch(connected, monkeypatch):
    async def process(*args, **kwargs):
        return result(
            stories=(
                story(),
                story(
                    url="https://news.example/bad",
                    classification=replace(story().classification, tone="INVALID"),
                ),
            )
        )

    monkeypatch.setattr("src.storage.db.process_items", process)
    with pytest.raises(RuntimeError, match="invalid input value"):
        await process_and_store([], database_url="test", content_types={})
    assert await connected.fetchval("SELECT count(*) FROM public.ingestion_urls") == 0
    assert (
        await connected.fetchval(
            "SELECT count(*) FROM public.stories WHERE canonical_url IS NOT NULL"
        )
        == 0
    )
    assert connected.closed


async def test_busy_worker_makes_no_model_calls(connected, monkeypatch):
    original = connected.fetchval

    async def fetchval(sql, *args):
        if "pg_try_advisory" in sql:
            return False
        return await original(sql, *args)

    monkeypatch.setattr(connected, "fetchval", fetchval)
    process = AsyncMock()
    monkeypatch.setattr("src.storage.db.process_items", process)
    with pytest.raises(WorkerBusyError):
        await process_and_store([], database_url="test")
    process.assert_not_awaited()
    assert connected.closed


async def test_public_rls_hides_story_and_all_children(pg):
    await store(pg, result(stories=(story(review_reasons=("low_confidence",)),)))
    story_id = await pg.fetchval(
        "SELECT id FROM public.stories WHERE canonical_url=$1", URL
    )
    await pg.execute("SET ROLE anon")
    for table, column in [
        ("stories", "id"),
        ("story_tags", "story_id"),
        ("story_topics", "story_id"),
        ("story_sources", "story_id"),
    ]:
        assert (
            await pg.fetchval(
                f"SELECT count(*) FROM public.{table} WHERE {column}=$1", story_id
            )
            == 0
        )
    with pytest.raises(RuntimeError, match="permission denied"):
        await pg.fetch("SELECT * FROM public.ingestion_urls")
    with pytest.raises(RuntimeError, match="permission denied"):
        await pg.execute("SELECT public.review_story(gen_random_uuid(), 'approve')")


async def test_review_admin_only_and_public_after_approval(pg):
    await store(pg, result(stories=(story(review_reasons=("check",)),)))
    queue_id = await pg.fetchval(
        "SELECT q.id FROM public.spot_check_queue q JOIN public.stories s ON s.id=q.story_id WHERE canonical_url=$1",
        URL,
    )
    await login(pg, USER)
    assert await pg.fetchval("SELECT count(*) FROM public.spot_check_queue") == 0
    with pytest.raises(RuntimeError, match="Administrator"):
        await pg.execute("SELECT public.review_story($1, 'approve')", queue_id)
    await login(pg, ADMIN)
    await pg.execute("SELECT public.review_story($1, 'approve')", queue_id)
    with pytest.raises(RuntimeError, match="no longer pending"):
        await pg.execute("SELECT public.review_story($1, 'approve')", queue_id)
    await pg.execute("SET ROLE anon")
    assert (
        await pg.fetchval(
            "SELECT count(*) FROM public.stories WHERE canonical_url=$1", URL
        )
        == 1
    )


async def test_incomplete_correction_rolls_back_and_valid_correction_publishes(pg):
    await store(pg, result(stories=(story(published_at=None, access=None),)))
    queue_id = await pg.fetchval(
        "SELECT q.id FROM public.spot_check_queue q JOIN public.stories s ON s.id=q.story_id WHERE canonical_url=$1",
        URL,
    )
    await login(pg, ADMIN)
    with pytest.raises(RuntimeError, match="Complete"):
        await pg.execute("SELECT public.review_story($1, 'approve')", queue_id)
    correction = {
        "summary": "Edited summary",
        "topics": ["Ethics"],
        "tone": "Useful",
        "access": "Free",
        "geography": "Europe",
        "published_at": None,
    }
    with pytest.raises(RuntimeError, match="Complete"):
        await pg.execute(
            "SELECT public.review_story($1, 'correct', $2::jsonb)",
            queue_id,
            json.dumps(correction),
        )
    assert (
        await pg.fetchval(
            "SELECT ai_generated_summary FROM public.stories WHERE canonical_url=$1",
            URL,
        )
        == story().ai_generated_summary
    )
    correction["published_at"] = DATE.isoformat()
    await pg.execute(
        "SELECT public.review_story($1, 'correct', $2::jsonb)",
        queue_id,
        json.dumps(correction),
    )
    assert (
        await pg.fetchval(
            "SELECT publication_status FROM public.stories WHERE canonical_url=$1", URL
        )
        == "published"
    )


async def test_rejection_stays_seen_and_private(pg):
    await store(pg, result(stories=(story(review_reasons=("uncertain_relevance",)),)))
    queue_id = await pg.fetchval(
        "SELECT q.id FROM public.spot_check_queue q JOIN public.stories s ON s.id=q.story_id WHERE canonical_url=$1",
        URL,
    )
    await login(pg, ADMIN)
    await pg.execute("SELECT public.review_story($1, 'reject')", queue_id)
    assert (
        await pg.fetchval(
            "SELECT status FROM public.spot_check_queue WHERE id=$1", queue_id
        )
        == "rejected"
    )
    await pg.execute("RESET ROLE")
    history = await load_history(pg, [FeedItem("Title", URL, DATE, "News", "", "")])
    assert URL in history.seen_urls
    assert not any(item.url == URL for item in history.existing_items)


async def test_missing_update_rolls_back(pg):
    with pytest.raises(ValueError, match="no stored story"):
        await store(
            pg,
            result(
                stories=(story(),),
                source_updates=(SourceUpdate("https://missing.test/", ()),),
            ),
        )
    assert await pg.fetchval("SELECT count(*) FROM public.ingestion_urls") == 0


async def test_deferred_items_survive_disappearing_from_feed(connected, monkeypatch):
    item = FeedItem(
        story().headline, URL, DATE, "News", "Models & Research", "PRIVATE EXCERPT"
    )
    await process_and_store(
        [item], database_url="test", content_types={}, max_new_stories=0
    )
    captured = []

    async def process(items, **kwargs):
        captured.extend(items)
        return result(stories=(story(review_reasons=("headline_only_evidence",)),))

    monkeypatch.setattr("src.storage.db.process_items", process)
    await process_and_store([], database_url="test", content_types={})
    assert [entry.url for entry in captured] == [URL]
    assert captured[0].raw_summary == ""
    assert "PRIVATE EXCERPT" not in str(connected.queries)
    assert (
        await connected.fetchval(
            "SELECT status FROM public.ingestion_urls WHERE url=$1", URL
        )
        == "stored"
    )


async def test_pending_items_are_interleaved_across_sources(connected, monkeypatch):
    items = [
        FeedItem("A1", "https://a.test/1", DATE, "Source A", "Ethics", ""),
        FeedItem("A2", "https://a.test/2", DATE, "Source A", "Ethics", ""),
        FeedItem("A3", "https://a.test/3", DATE, "Source A", "Ethics", ""),
        FeedItem("B1", "https://b.test/1", DATE, "Source B", "Ethics", ""),
    ]
    captured = []

    async def process(batch, **kwargs):
        captured.extend(batch)
        return result(deferred_urls=tuple(item.url for item in batch))

    monkeypatch.setattr("src.storage.db.process_items", process)
    await process_and_store(items, database_url="test", content_types={})

    assert [item.source_name for item in captured] == [
        "Source A",
        "Source B",
        "Source A",
        "Source A",
    ]


async def test_legacy_source_is_seen_without_creating_retry(connected, monkeypatch):
    model = AsyncMock(side_effect=AssertionError("Model must not run"))
    monkeypatch.setattr("src.processing.pipeline.summarise_story", model)
    item = FeedItem("Legacy story", "https://www.reuters.com", DATE, "Reuters", "", "")
    output = await process_and_store([item], database_url="test", content_types={})
    assert output.skipped_urls == ("https://www.reuters.com/",)
    assert await connected.fetchval("SELECT count(*) FROM public.ingestion_urls") == 0
    model.assert_not_awaited()


async def test_source_update_replay_does_not_undo_approval(pg):
    await store(pg, result(stories=(story(),)))
    update = result(
        source_updates=(
            SourceUpdate(
                URL, (StorySource("Other", "https://other.test/story", "Free"),)
            ),
        )
    )
    await store(pg, update)
    queue_id = await pg.fetchval(
        "SELECT q.id FROM public.spot_check_queue q JOIN public.stories s ON s.id=q.story_id WHERE canonical_url=$1",
        URL,
    )
    await login(pg, ADMIN)
    await pg.execute("SELECT public.review_story($1, 'approve')", queue_id)
    await pg.execute("RESET ROLE")
    await store(pg, update)
    assert (
        await pg.fetchval(
            "SELECT publication_status FROM public.stories WHERE canonical_url=$1", URL
        )
        == "published"
    )


async def test_first_signup_is_not_automatically_admin(pg):
    await pg.execute(
        "INSERT INTO auth.users(id, email) VALUES ($1, $2)",
        USER,
        "visitor@example.test",
    )
    assert (
        await pg.fetchval("SELECT count(*) FROM public.user_roles WHERE role = 'admin'")
        == 0
    )
    assert (
        await pg.fetchval("SELECT role FROM public.user_roles WHERE user_id = $1", USER)
        == "user"
    )
