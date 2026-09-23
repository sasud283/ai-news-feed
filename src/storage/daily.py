"""Scheduled ingestion with a private completion email to the site editor."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import asyncpg
import httpx

from src.processing.models import ProcessedStory, ProcessingResult
from src.storage.db import _INPUT_USD_PER_MILLION, _OUTPUT_USD_PER_MILLION
from src.storage.run import run_batch

logger = logging.getLogger(__name__)
MALTA = ZoneInfo("Europe/Malta")


def _needs_review(story: ProcessedStory) -> bool:
    return bool(
        story.review_reasons
        or not story.published_at
        or not story.ai_generated_summary.strip()
        or not story.classification.topics
        or not story.classification.tone
        or not story.classification.geography
        or not story.access
        or not story.sources
        or not story.classification.relevant
    )


def _report_text(
    result: ProcessingResult | None,
    *,
    started_at: datetime,
    review_url: str,
    error_type: str | None = None,
    test_only: bool = False,
) -> str:
    date = started_at.astimezone(MALTA).strftime("%d %B %Y, %H:%M %Z")
    if test_only:
        return f"Pipeline email test for {date}. No news batch was run.\n\nReview: {review_url}"
    if error_type:
        return (
            f"Pipeline failed on {date}.\n"
            f"Error type: {error_type}\n"
            "No successful completion is confirmed. Check the GitHub Actions run.\n\n"
            f"Review: {review_url}"
        )
    if result is None:
        raise ValueError("A completed report requires a processing result")
    review_count = sum(_needs_review(story) for story in result.stories)
    estimated_cost = (
        result.prompt_tokens * _INPUT_USD_PER_MILLION
        + result.completion_tokens * _OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    return (
        f"Pipeline completed on {date}.\n\n"
        f"New stories: {len(result.stories)}\n"
        f"Published automatically: {len(result.stories) - review_count}\n"
        f"Sent to review: {review_count}\n"
        f"Existing stories with new sources: {len(result.source_updates)}\n"
        f"Filtered out: {len(result.rejected_urls)}\n"
        f"Already known: {len(result.skipped_urls)}\n"
        f"Deferred: {len(result.deferred_urls)}\n"
        f"Processing failures: {len(result.failures)}\n\n"
        f"Model: {result.model or 'none'}\n"
        f"Model calls: {result.model_calls}\n"
        f"Input tokens: {result.prompt_tokens:,}\n"
        f"Output tokens: {result.completion_tokens:,}\n"
        f"Estimated model cost: ${estimated_cost:.6f} USD\n"
        "Cost is a lower bound when failed model responses have unrecorded usage.\n\n"
        f"Review stories: {review_url}"
    )


async def _send_report(
    body: str, *, started_at: datetime, success: bool, test_only: bool = False
) -> None:
    """Send one completion email through Resend without logging credentials.

    Args:
        body: Plain-text report without publisher excerpts.
        started_at: Start time used for a stable local idempotency key.
        success: Whether ingestion completed successfully.
        test_only: Whether this message is an email-configuration check.
    """
    recipient = os.environ["PIPELINE_REPORT_TO"]
    sender = os.environ["NEWSLETTER_FROM"]
    api_key = os.environ["RESEND_API_KEY"]
    run_id = os.environ.get("GITHUB_RUN_ID")
    attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    identity = (
        f"{run_id}/{attempt}" if run_id else started_at.strftime("%Y%m%dT%H%M%S%f")
    )
    status = "TEST" if test_only else "SUCCESS" if success else "FAILED"
    payload = {
        "from": sender,
        "to": [recipient],
        "subject": f"The Full Picture AI pipeline — {status} — {started_at.astimezone(MALTA):%d %b %Y}",
        "text": body,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Idempotency-Key": f"pipeline-report/{identity}",
            },
        )
        response.raise_for_status()
    logger.info("pipeline_report_email_accepted")


async def _check_database() -> None:
    connection = await asyncpg.connect(
        os.environ["DATABASE_URL"], statement_cache_size=0, timeout=30
    )
    try:
        await connection.fetchval("SELECT 1")
    finally:
        await connection.close()


async def run_daily(*, max_new_stories: int = 100, test_email: bool = False) -> None:
    """Run one bounded news batch and email its outcome to the editor.

    Args:
        max_new_stories: Maximum model requests in the batch.
        test_email: Check the email path without running ingestion.

    Raises:
        Exception: The batch or completion email failed.
    """
    started_at = datetime.now(UTC)
    review_url = os.environ["PIPELINE_REVIEW_URL"]
    if test_email:
        await _check_database()
        body = _report_text(
            None, started_at=started_at, review_url=review_url, test_only=True
        )
        await _send_report(body, started_at=started_at, success=True, test_only=True)
        return
    try:
        result = await run_batch(max_new_stories=max_new_stories)
    except Exception as exc:
        body = _report_text(
            None,
            started_at=started_at,
            review_url=review_url,
            error_type=type(exc).__name__,
        )
        await _send_report(body, started_at=started_at, success=False)
        raise
    body = _report_text(result, started_at=started_at, review_url=review_url)
    await _send_report(body, started_at=started_at, success=True)


def main() -> None:
    """Execute the scheduled runner or a non-ingesting email test."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-new-stories", type=int, default=100)
    parser.add_argument("--test-email", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    asyncio.run(
        run_daily(max_new_stories=args.max_new_stories, test_email=args.test_email)
    )


if __name__ == "__main__":
    main()
