"""Daily reports describe committed results and notify on failures."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.processing.models import ProcessingResult
from src.storage.daily import _report_text, run_daily

START = datetime(2026, 9, 23, 11, 5, tzinfo=UTC)
REVIEW = "https://example.org/review"


def test_report_counts_review_and_cost():
    complete = SimpleNamespace(
        review_reasons=(),
        published_at=START,
        ai_generated_summary="A useful summary.",
        classification=SimpleNamespace(
            topics=("Models & Research",),
            tone="Neutral",
            geography="Worldwide",
            relevant=True,
        ),
        access="Free",
        sources=(object(),),
    )
    review = SimpleNamespace(
        **{**vars(complete), "review_reasons": ("unknown_access",)}
    )
    result = ProcessingResult(
        (complete, review),
        (),
        (),
        ("https://example.org/rejected",),
        (),
        (),
        "gpt-4o-mini",
        2,
        1_000,
        100,
    )
    text = _report_text(result, started_at=START, review_url=REVIEW)
    assert "Published automatically: 1" in text
    assert "Sent to review: 1" in text
    assert "Filtered out: 1" in text
    assert "Input tokens: 1,000" in text
    assert "Estimated model cost: $0.000210 USD" in text
    assert REVIEW in text


async def test_failed_batch_still_sends_failure_email(monkeypatch):
    monkeypatch.setenv("PIPELINE_REVIEW_URL", REVIEW)
    runner = AsyncMock(side_effect=ValueError("private diagnostic"))
    sender = AsyncMock()
    monkeypatch.setattr("src.storage.daily.run_batch", runner)
    monkeypatch.setattr("src.storage.daily._send_report", sender)

    with pytest.raises(ValueError, match="private diagnostic"):
        await run_daily()

    assert "Pipeline failed" in sender.await_args.args[0]
    assert "Error type: ValueError" in sender.await_args.args[0]
    assert "private diagnostic" not in sender.await_args.args[0]
    assert sender.await_args.kwargs["success"] is False


async def test_email_test_does_not_run_pipeline(monkeypatch):
    monkeypatch.setenv("PIPELINE_REVIEW_URL", REVIEW)
    runner = AsyncMock()
    sender = AsyncMock()
    monkeypatch.setattr("src.storage.daily.run_batch", runner)
    monkeypatch.setattr("src.storage.daily._send_report", sender)

    await run_daily(test_email=True)

    runner.assert_not_awaited()
    assert "No news batch was run" in sender.await_args.args[0]
