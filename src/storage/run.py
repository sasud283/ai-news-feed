"""Manual, bounded RSS → processing → storage batch (no scheduling)."""

import argparse
import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import asyncpg
from openai import OpenAIError

from src.ingestion.rss_poller import FeedItem, Source, poll_all_sources
from src.processing.models import ProcessingResult
from src.processing.pipeline import logger
from src.storage.db import process_and_store
from src.storage.models import WorkerBusyError


def _published_since(items: list[FeedItem], cutoff: datetime) -> list[FeedItem]:
    if cutoff.tzinfo is None:
        raise ValueError("published_since must include a timezone")
    return [
        item
        for item in items
        if item.published_at is not None
        and (
            item.published_at.replace(tzinfo=UTC)
            if item.published_at.tzinfo is None
            else item.published_at
        )
        >= cutoff
    ]


async def run_batch(
    *,
    max_new_stories: int = 100,
    published_since: datetime | None = None,
) -> ProcessingResult:
    """Poll the active registry and persist results using environment credentials.

    Args:
        max_new_stories: Maximum model requests, with remaining entries deferred.
        published_since: Earliest publication time to process. Defaults to 48 hours
            before the batch starts so full feed archives are never staged.

    Returns:
        The committed processing result.

    Raises:
        ValueError: Credentials are missing or the request limit is negative.
        WorkerBusyError: Another database worker owns the batch lock.
    """
    if max_new_stories < 0:
        raise ValueError("max_new_stories must be nonnegative")
    if not os.environ.get("DATABASE_URL"):
        raise ValueError("DATABASE_URL is required")
    if max_new_stories and not os.environ.get("OPENAI_API_KEY"):
        raise ValueError("OPENAI_API_KEY is required for model processing")
    path = Path(__file__).parents[1] / "ingestion/sources.json"
    sources = [
        Source(**value) for value in json.loads(await asyncio.to_thread(path.read_text))
    ]
    items = await poll_all_sources(sources)
    cutoff = published_since or datetime.now(UTC) - timedelta(hours=48)
    items = _published_since(items, cutoff)
    return await process_and_store(items, max_new_stories=max_new_stories)


def main() -> None:
    """Run one batch with a configurable model budget and JSON status logging."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-new-stories", type=int, default=100)
    parser.add_argument(
        "--since",
        type=datetime.fromisoformat,
        help="earliest publication timestamp (ISO 8601; default: 48 hours ago)",
    )
    args = parser.parse_args()
    try:
        asyncio.run(
            run_batch(
                max_new_stories=args.max_new_stories,
                published_since=args.since,
            )
        )
    except WorkerBusyError:
        logger.info("storage_busy")
        raise SystemExit(2) from None
    except (ValueError, OSError, asyncpg.PostgresError, OpenAIError) as exc:
        logger.error("storage_error", extra={"error_type": type(exc).__name__})
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
