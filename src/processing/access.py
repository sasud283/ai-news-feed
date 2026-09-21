"""Source-level access defaults for automated ingestion."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from src.ingestion.rss_poller import FeedItem
from src.processing.deduplicator import canonical_url
from src.processing.models import Access


@lru_cache(maxsize=1)
def _registry() -> dict[str, Access]:
    path = Path(__file__).with_name("source_access.json")
    values = json.loads(path.read_text())
    if not isinstance(values, dict) or any(
        not isinstance(name, str) or access not in {"Free", "Paid"}
        for name, access in values.items()
    ):
        raise ValueError("Invalid source access registry")
    return values


def infer_access_by_url(items: list[FeedItem]) -> dict[str, Access]:
    """Resolve article access from the maintained active-source registry.

    Args:
        items: Feed entries whose source names identify the publisher.

    Returns:
        Access by URL. A confirmed free route wins when duplicate sources disagree;
        sources absent from the registry remain unknown and require review.
    """
    registry = _registry()
    result: dict[str, Access] = {}
    for item in items:
        access = registry.get(item.source_name)
        if access is None:
            continue
        url = canonical_url(item.url)
        if result.get(url) != "Free":
            result[url] = access
    return result
