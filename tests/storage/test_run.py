"""The manual runner validates configuration before polling or model spending."""

from unittest.mock import AsyncMock

import pytest

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
    assert len(poll.call_args.args[0]) == 66
    persist.assert_awaited_once_with([], max_new_stories=0)
