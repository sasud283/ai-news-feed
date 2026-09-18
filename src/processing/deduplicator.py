"""Conservative local article grouping with URL and headline/fact matching."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from src.ingestion.rss_poller import FeedItem
from src.processing.models import ContentType

_TRACKING = {"fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid"}
_UPDATES = re.compile(
    r"\b(correction|corrected|update|updated|retracts|retraction)\b", re.IGNORECASE
)


@dataclass(frozen=True, slots=True)
class StoryGroup:
    """Transient feed items representing one event, retaining all source links."""

    items: tuple[FeedItem, ...]
    content_type: ContentType = "Article"
    related_to_url: str | None = None


def canonical_url(url: str) -> str:
    """Remove fragments and known tracking parameters without dropping story IDs.

    Args:
        url: Absolute HTTP(S) story URL.

    Returns:
        Normalized URL, preserving content query parameters and path case.

    Raises:
        ValueError: The URL has no HTTP(S) host or contains embedded credentials.
    """
    parsed = urlsplit(url.strip())
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Expected an absolute HTTP(S) URL without credentials")
    host = parsed.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    port = parsed.port
    if port and (parsed.scheme, port) not in {("http", 80), ("https", 443)}:
        host = f"{host}:{port}"
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING
    ]
    return urlunsplit((parsed.scheme, host, parsed.path or "/", urlencode(query), ""))


def _title(text: str) -> str:
    return " ".join(
        re.findall(r"\w+|[$€£¥%]", unicodedata.normalize("NFKC", text).casefold())
    )


def _date(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _near(a: FeedItem, b: FeedItem) -> bool:
    if a.published_at is None or b.published_at is None:
        return False
    return abs(_date(a.published_at) - _date(b.published_at)) <= timedelta(hours=72)


def _same_event(a: FeedItem, b: FeedItem) -> bool:
    if not _near(a, b):
        return False
    left, right = _title(a.title), _title(b.title)
    if len(left.split()) < 5 or len(right.split()) < 5:
        return False
    if left == right:
        return True
    if _UPDATES.search(a.title) or _UPDATES.search(b.title):
        return False
    # Require identical words including entities and numbers; only word-order or
    # punctuation variants qualify. Paraphrases stay separate rather than guessing.
    if sorted(left.split()) != sorted(right.split()):
        return False
    # Reordered entities or amounts can reverse an acquisition or funding claim.
    anchors = r"\b(?:[A-Z][\w-]*|\d[\w.-]*)\b"
    if re.findall(anchors, a.title) != re.findall(anchors, b.title):
        return False
    return SequenceMatcher(None, left, right, autojunk=False).ratio() >= 0.85


def group_items(
    items: Sequence[FeedItem],
    *,
    content_types: Mapping[str, ContentType] | None = None,
) -> list[StoryGroup]:
    """Group duplicate articles while retaining each publisher's attribution.

    Args:
        items: Incoming feeds, optionally prefixed with recent stored metadata.
        content_types: Source name to content type; omitted names are articles.

    Returns:
        Groups in input order. Podcast/video episodes only merge identical URLs.
        Explicit update headlines may carry a conservative related-story link.

    Raises:
        ValueError: A URL or a supplied content type is invalid.
    """
    types = content_types or {}
    groups: list[StoryGroup] = []
    for item in items:
        kind = types.get(item.source_name, "Article")
        if kind not in {"Article", "Podcast", "Video"}:
            raise ValueError("Unknown content type")
        url = canonical_url(item.url)
        for index, group in enumerate(groups):
            exact = any(canonical_url(old.url) == url for old in group.items)
            similar = kind == group.content_type == "Article" and all(
                _same_event(old, item) for old in group.items
            )
            if group.content_type == kind and (exact or similar):
                if not any(
                    canonical_url(old.url) == url
                    and old.source_name == item.source_name
                    for old in group.items
                ):
                    groups[index] = StoryGroup(
                        (*group.items, item), group.content_type, group.related_to_url
                    )
                break
        else:
            related = None
            if kind == "Article" and _UPDATES.search(item.title):
                title = _title(_UPDATES.sub("", item.title))
                for group in groups:
                    old = group.items[0]
                    if (
                        group.content_type == "Article"
                        and _near(old, item)
                        and not _UPDATES.search(old.title)
                        and SequenceMatcher(None, title, _title(old.title)).ratio()
                        > 0.9
                    ):
                        related = canonical_url(old.url)
                        break
            groups.append(StoryGroup((item,), kind, related))
    return groups
