"""Persistent processing history without publisher excerpts."""

from dataclasses import dataclass

from src.ingestion.rss_poller import FeedItem


@dataclass(frozen=True, slots=True)
class ProcessingHistory:
    """Completed URLs and nearby story metadata for cross-run deduplication."""

    seen_urls: frozenset[str]
    existing_items: tuple[FeedItem, ...]


class WorkerBusyError(RuntimeError):
    """Another ingestion batch owns the database processing lock."""
