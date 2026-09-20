"""Manual, bounded RSS → processing → storage batch (no scheduling)."""

import argparse
import asyncio
import json
import os
from pathlib import Path

import asyncpg
from openai import OpenAIError

from src.ingestion.rss_poller import Source, poll_all_sources
from src.processing.pipeline import logger
from src.storage.db import process_and_store
from src.storage.models import WorkerBusyError


async def run_batch(*, max_new_stories: int = 100) -> None:
    """Poll the active registry and persist results using environment credentials.

    Args:
        max_new_stories: Maximum model requests, with remaining entries deferred.

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
    await process_and_store(items, max_new_stories=max_new_stories)


def main() -> None:
    """Run one batch with a configurable model budget and JSON status logging."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-new-stories", type=int, default=100)
    args = parser.parse_args()
    try:
        asyncio.run(run_batch(max_new_stories=args.max_new_stories))
    except WorkerBusyError:
        logger.info("storage_busy")
        raise SystemExit(2) from None
    except (ValueError, OSError, asyncpg.PostgresError, OpenAIError) as exc:
        logger.error("storage_error", extra={"error_type": type(exc).__name__})
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
