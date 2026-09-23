"""The manual runner validates configuration before polling or model spending."""

from datetime import UTC, datetime, timedelta
from unittest.mock import ANY, AsyncMock

import pytest

from src.ingestion.rss_poller import FeedItem
from src.storage.run import run_batch


async def test_missing_configuration_fails_before_polling(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    poll = AsyncMock()
    monkeypatch.setattr("src.storage.run.poll_all_sources", poll)
    with pytest.raises(ValueError, match="DATABASE_URL"):
        await run_batch()
    poll.assert_not_awaited()


async def test_runner_uses_active_registry_and_budget(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "test-only")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    poll = AsyncMock(return_value=[])
    persist = AsyncMock()
    monkeypatch.setattr("src.storage.run.poll_all_sources", poll)
    monkeypatch.setattr("src.storage.run.process_and_store", persist)
    await run_batch(max_new_stories=0)
    assert len(poll.call_args.args[0]) == 64
    persist.assert_awaited_once_with(
        [], max_new_stories=0, started_at=ANY, published_since=ANY
    )


async def test_runner_filters_old_and_undated_feed_entries(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "test-only")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    cutoff = datetime(2026, 9, 21, tzinfo=UTC)
    recent = FeedItem(
        "Recent", "https://example.com/recent", cutoff, "Example", "Ethics", ""
    )
    old = FeedItem(
        "Old",
        "https://example.com/old",
        cutoff - timedelta(seconds=1),
        "Example",
        "Ethics",
        "",
    )
    undated = FeedItem(
        "Undated", "https://example.com/undated", None, "Example", "Ethics", ""
    )
    monkeypatch.setattr(
        "src.storage.run.poll_all_sources",
        AsyncMock(return_value=[old, undated, recent]),
    )
    persist = AsyncMock()
    monkeypatch.setattr("src.storage.run.process_and_store", persist)

    await run_batch(max_new_stories=0, published_since=cutoff)

    persist.assert_awaited_once_with(
        [recent], max_new_stories=0, started_at=ANY, published_since=cutoff
    )
