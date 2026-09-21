"""Async Postgres storage for the existing Supabase schema."""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import asyncpg
from openai import AsyncOpenAI

from src.ingestion.rss_poller import FeedItem
from src.processing.deduplicator import canonical_url
from src.processing.models import Access, ContentType, ProcessingResult, StorySource
from src.processing.pipeline import logger, process_items
from src.storage.models import ProcessingHistory, WorkerBusyError

# Shared transaction lock prevents concurrent workers from paying for the same batch.
_LOCK_ID = 746_320_911
# Legacy seed/source records may omit a homepage's trailing slash.
_LEGACY_URL_SQL = (
    "CASE WHEN source_url ~ '^https?://[^/]+$' "
    "THEN source_url || '/' ELSE source_url END"
)


async def load_history(
    connection: asyncpg.Connection, items: Sequence[FeedItem]
) -> ProcessingHistory:
    """Read completed URLs and nearby metadata inside the worker transaction.

    Args:
        connection: Connection owning the processing lock.
        items: Incoming items; invalid URLs are left for processing validation.

    Returns:
        History containing no original article text.
    """
    urls = []
    for item in items:
        try:
            urls.append(canonical_url(item.url))
        except ValueError:
            continue
    dates = [
        value.replace(tzinfo=UTC) if value.tzinfo is None else value
        for item in items
        if (value := item.published_at) is not None
    ]
    rows = await connection.fetch(
        "SELECT url FROM public.ingestion_urls WHERE url = ANY($1::text[]) "
        "AND status IN ('stored', 'rejected') "
        f"UNION SELECT {_LEGACY_URL_SQL} FROM public.story_sources "
        f"WHERE ({_LEGACY_URL_SQL}) = ANY($1::text[])",
        urls,
    )
    existing = await connection.fetch(
        "SELECT canonical_url, headline, published_at, content_type "
        "FROM public.stories WHERE canonical_url IS NOT NULL "
        "AND publication_status <> 'rejected' AND published_at BETWEEN $1 AND $2 "
        "ORDER BY published_at, id",
        min(dates) - timedelta(hours=72) if dates else datetime.now(UTC),
        max(dates) + timedelta(hours=72) if dates else datetime.now(UTC),
    )
    return ProcessingHistory(
        frozenset(row["url"] for row in rows),
        tuple(
            FeedItem(
                row["headline"],
                row["canonical_url"],
                row["published_at"],
                f"stored:{row['content_type']}",
                "",
                "",
            )
            for row in existing
        ),
    )


async def _pending_items(
    connection: asyncpg.Connection, items: Sequence[FeedItem]
) -> list[FeedItem]:
    incoming = {}
    invalid = []
    for item in items:
        try:
            url = canonical_url(item.url)
        except ValueError:
            invalid.append(item)
            continue
        incoming.setdefault(url, []).append(item)
        date = item.published_at
        if date is not None and date.tzinfo is None:
            date = date.replace(tzinfo=UTC)
        await connection.execute(
            "INSERT INTO public.ingestion_urls(url, status, headline, published_at, source_name, category) "
            "SELECT $1, 'deferred', $2, $3, $4, $5 WHERE NOT EXISTS "
            f"(SELECT 1 FROM public.story_sources WHERE ({_LEGACY_URL_SQL}) = $1) "
            "ON CONFLICT (url) DO UPDATE SET "
            "headline = EXCLUDED.headline, published_at = EXCLUDED.published_at, "
            "source_name = EXCLUDED.source_name, category = EXCLUDED.category "
            "WHERE ingestion_urls.status IN ('failed', 'deferred')",
            url,
            item.title,
            date,
            item.source_name,
            item.category,
        )
    pending = await connection.fetch(
        "SELECT url, headline, published_at, source_name, category FROM ("
        "SELECT url, headline, published_at, source_name, category, updated_at, "
        "row_number() OVER (PARTITION BY source_name ORDER BY updated_at, url) AS source_rank "
        "FROM public.ingestion_urls WHERE status IN ('failed', 'deferred') "
        "AND headline IS NOT NULL) ranked "
        "WHERE source_rank <= 5 ORDER BY source_rank, updated_at, url LIMIT 500"
    )
    # Prioritize older retries to prevent starvation; refreshed excerpts remain transient.
    combined = []
    for row in pending:
        combined.extend(
            incoming.pop(
                row["url"],
                [
                    FeedItem(
                        row["headline"],
                        row["url"],
                        row["published_at"],
                        row["source_name"],
                        row["category"],
                        "",
                    )
                ],
            )
        )
    if incoming:
        retry_rows = await connection.fetch(
            "SELECT url FROM public.ingestion_urls WHERE url = ANY($1::text[]) "
            "AND status IN ('failed', 'deferred')",
            list(incoming),
        )
        retry_urls = {row["url"] for row in retry_rows}
        combined.extend(
            item
            for url, values in incoming.items()
            if url not in retry_urls
            for item in values
        )
    return [*combined, *invalid]


async def _record(
    connection: asyncpg.Connection,
    url: str,
    status: str,
    story_id: UUID | None = None,
    error_type: str | None = None,
) -> None:
    try:
        url = canonical_url(url)
    except ValueError:
        # Do not persist malformed URLs, which may contain embedded credentials.
        return
    await connection.execute(
        "INSERT INTO public.ingestion_urls(url, status, story_id, error_type) "
        "VALUES ($1, $2, $3, $4) ON CONFLICT (url) DO UPDATE SET "
        "status = EXCLUDED.status, story_id = EXCLUDED.story_id, "
        "error_type = EXCLUDED.error_type, updated_at = now() "
        "WHERE ingestion_urls.status NOT IN ('stored', 'rejected')",
        url,
        status,
        story_id,
        error_type,
    )


async def _sources(
    connection: asyncpg.Connection, story_id: UUID, sources: Sequence[StorySource]
) -> bool:
    changed = False
    for source in sources:
        url = canonical_url(source.source_url)
        inserted = await connection.fetchval(
            "INSERT INTO public.story_sources(story_id, source_name, source_url, is_paywalled) "
            "SELECT $1, $2, $3, $4 WHERE NOT EXISTS "
            "(SELECT 1 FROM public.story_sources WHERE story_id = $1 AND source_url = $3 "
            "AND source_name = $2) RETURNING id",
            story_id,
            source.source_name,
            url,
            None if source.access is None else source.access == "Paid",
        )
        changed |= inserted is not None
        await _record(connection, url, "stored", story_id)
    return changed


async def _queue(
    connection: asyncpg.Connection, story_id: UUID, reasons: Sequence[str]
) -> None:
    await connection.execute(
        "UPDATE public.spot_check_queue SET reason = concat_ws(', ', reason, $2) "
        "WHERE story_id = $1 AND status = 'pending' AND strpos(reason, $2) = 0",
        story_id,
        ", ".join(reasons),
    )
    await connection.execute(
        "INSERT INTO public.spot_check_queue(story_id, reason) "
        "SELECT $1, $2 WHERE NOT EXISTS "
        "(SELECT 1 FROM public.spot_check_queue WHERE story_id = $1 AND status = 'pending')",
        story_id,
        ", ".join(reasons),
    )


async def save_result(connection: asyncpg.Connection, result: ProcessingResult) -> None:
    """Persist a result atomically using the caller's locked transaction.

    Args:
        connection: Connection inside a transaction owning the ingestion lock.
        result: Validated processing output; original excerpts are never accepted.

    Raises:
        ValueError: A source update targets a missing story.
        asyncpg.PostgresError: A write fails; the caller must roll back the batch.
    """
    if not connection.is_in_transaction():
        raise ValueError("save_result requires the worker transaction")
    for story in result.stories:
        reasons = list(story.review_reasons)
        tags = story.classification
        if (
            not story.published_at
            or not story.ai_generated_summary.strip()
            or not tags.topics
            or not tags.tone
            or not tags.geography
            or not story.access
            or not story.sources
            or not tags.relevant
        ):
            reasons.append("incomplete_metadata")
        url = canonical_url(story.url)
        story_id = await connection.fetchval(
            "INSERT INTO public.stories(headline, ai_generated_summary, published_at, "
            "canonical_url, publication_status, content_type, media_url, "
            "processing_metadata, related_to_url) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) "
            "ON CONFLICT (canonical_url) DO NOTHING RETURNING id",
            story.headline,
            story.ai_generated_summary,
            (
                story.published_at.replace(tzinfo=UTC)
                if story.published_at and story.published_at.tzinfo is None
                else story.published_at
            ),
            url,
            "review" if reasons else "published",
            story.content_type,
            url if story.content_type != "Article" else None,
            json.dumps({"classification": asdict(tags), "review_reasons": reasons}),
            story.related_to_url,
        )
        if story_id is None:
            # Idempotent replay must not overwrite an editor's approved changes.
            continue
        await connection.execute(
            "INSERT INTO public.story_tags(story_id, tone, access, geography) VALUES ($1,$2,$3,$4)",
            story_id,
            tags.tone,
            story.access,
            tags.geography,
        )
        for topic in tags.topics:
            await connection.execute(
                "INSERT INTO public.story_topics(story_id, topic) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                story_id,
                topic,
            )
        await _record(connection, url, "stored", story_id)
        await _sources(connection, story_id, story.sources)
        if reasons:
            await _queue(connection, story_id, reasons)
    for update in result.source_updates:
        story_id = await connection.fetchval(
            "SELECT story_id FROM public.ingestion_urls WHERE url = $1 AND status = 'stored'",
            canonical_url(update.existing_url),
        )
        if story_id is None:
            raise ValueError("Source update has no stored story")
        await connection.execute(
            "SELECT id FROM public.stories WHERE id = $1 FOR UPDATE", story_id
        )
        if not await _sources(connection, story_id, update.sources):
            continue
        await connection.execute(
            "UPDATE public.stories SET publication_status = 'review', updated_at = now() WHERE id = $1",
            story_id,
        )
        await connection.execute(
            "UPDATE public.story_tags SET access = CASE "
            "WHEN EXISTS (SELECT 1 FROM public.story_sources WHERE story_id = $1 AND is_paywalled = false) "
            "THEN 'Free'::public.story_access "
            "WHEN NOT EXISTS (SELECT 1 FROM public.story_sources WHERE story_id = $1 AND is_paywalled IS NULL) "
            "THEN 'Paid'::public.story_access ELSE NULL END WHERE story_id = $1",
            story_id,
        )
        await _queue(connection, story_id, update.review_reasons)
    for url in result.rejected_urls:
        await _record(connection, url, "rejected")
    for url in result.deferred_urls:
        await _record(connection, url, "deferred")
    for failure in result.failures:
        for url in failure.urls:
            await _record(connection, url, "failed", error_type=failure.error_type)


async def process_and_store(
    items: Sequence[FeedItem],
    *,
    database_url: str | None = None,
    client: AsyncOpenAI | None = None,
    max_new_stories: int = 100,
    access_by_url: Mapping[str, Access] | None = None,
    content_types: Mapping[str, ContentType] | None = None,
) -> ProcessingResult:
    """Deduplicate, process and commit one batch to Supabase Postgres.

    Args:
        items: Polled feed entries whose publisher excerpts remain in memory only.
        database_url: Postgres DSN; otherwise DATABASE_URL from the environment.
        client: Optional caller-owned model client for testing or connection reuse.
        max_new_stories: Model request budget per batch.
        access_by_url: Verified per-article access, never inferred from a publisher.
        content_types: Optional source-type map; defaults to the Phase 2 registry.

    Returns:
        Processing results after their database transaction commits.

    Raises:
        ValueError: DATABASE_URL is missing.
        WorkerBusyError: Another worker owns the processing lock; no model calls made.
        asyncpg.PostgresError: Database work failed and the batch was rolled back.
    """
    dsn = database_url or os.environ.get("DATABASE_URL")
    if not dsn:
        raise ValueError("Set DATABASE_URL to the Supabase Postgres connection string")
    connection = await asyncpg.connect(dsn, statement_cache_size=0, timeout=30)
    try:
        async with connection.transaction():
            if not await connection.fetchval(
                "SELECT pg_try_advisory_xact_lock($1)", _LOCK_ID
            ):
                raise WorkerBusyError("Another ingestion batch is running")
            items = await _pending_items(connection, items)
            history = await load_history(connection, items)
            if content_types is None:
                path = Path(__file__).parents[1] / "processing/source_types.json"
                content_types = json.loads(await asyncio.to_thread(path.read_text))
            types = {
                **content_types,
                **{f"stored:{kind}": kind for kind in ("Article", "Podcast", "Video")},
            }
            result = await process_items(
                items,
                seen_urls=history.seen_urls,
                existing_items=history.existing_items,
                client=client,
                max_new_stories=max_new_stories,
                access_by_url=access_by_url,
                content_types=types,
            )
            await save_result(connection, result)
        logger.info("storage_committed")
        return result
    finally:
        await connection.close()
