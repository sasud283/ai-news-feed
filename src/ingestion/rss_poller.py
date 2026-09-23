"""Async RSS/Atom ingestion; no article bodies or files are persisted.

HTTPX owns all network I/O, including the retry when feedparser cannot parse
raw bytes. The retry supplies HTTP-decoded text to feedparser because HTTPX
is a transport, not an RSS parser. Limiters are shared within each polling batch;
callers should not run overlapping batches against the same domains.
"""

from __future__ import annotations

import asyncio
import calendar
import html
import json
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
from xml.sax import SAXException

import feedparser
import httpx

DEFAULT_DELAY = 2.0
USER_AGENT = "TheFullPictureAI/0.1"


@dataclass(frozen=True, slots=True)
class Source:
    """A source registry entry with its feed URL and editorial metadata."""

    name: str
    url: str
    feed_url: str
    category: str
    region: str
    connection_type: str
    notes: str


@dataclass(frozen=True, slots=True)
class FeedItem:
    """Feed metadata; raw_summary is transient and must not be persisted.

    Only a publisher-provided summary is returned, never content:encoded or
    Atom content. Storage must replace raw_summary with an AI-generated summary.
    """

    title: str
    url: str
    published_at: datetime | None
    source_name: str
    category: str
    raw_summary: str
    enclosure_type: str | None = None


class JsonFormatter(logging.Formatter):
    """Format per-feed outcomes as JSON without logging feed contents."""

    def format(self, record: logging.LogRecord) -> str:
        """Serialize a log record.

        Args:
            record: Outcome record with optional feed metadata.

        Returns:
            One JSON object suitable for a structured log collector.
        """
        return json.dumps(
            {
                "level": record.levelname,
                "event": record.getMessage(),
                "source": getattr(record, "source", None),
                "feed_url": getattr(record, "feed_url", None),
                "item_count": getattr(record, "item_count", 0),
                "error_type": getattr(record, "error_type", None),
            }
        )


logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def _domain(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Feed URL must be an absolute HTTP(S) URL")
    return parsed.hostname.lower()


class _Poller:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client
        self.locks: dict[str, asyncio.Lock] = {}
        self.last_request: dict[str, float] = {}
        self.delays: dict[str, float] = {}
        self.robots_locks: dict[str, asyncio.Lock] = {}
        self.robots: dict[str, RobotFileParser | None] = {}

    async def _request(self, url: str, *, accept: str) -> httpx.Response:
        domain = _domain(url)
        async with self.locks.setdefault(domain, asyncio.Lock()):
            previous = self.last_request.get(domain)
            if previous is not None:
                remaining = self.delays.get(domain, DEFAULT_DELAY) - (
                    time.monotonic() - previous
                )
                if remaining > 0:
                    await asyncio.sleep(remaining)
            self.last_request[domain] = time.monotonic()
            return await self.client.get(url, headers={"Accept": accept})

    async def _robots_for(self, url: str) -> RobotFileParser | None:
        parsed = urlsplit(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        async with self.robots_locks.setdefault(origin, asyncio.Lock()):
            if origin not in self.robots:
                response = await self._request(
                    origin + "/robots.txt", accept="text/plain"
                )
                if response.status_code in {404, 410}:
                    self.robots[origin] = None
                else:
                    # Fail this feed closed for unavailable or redirected policies.
                    response.raise_for_status()
                    policy = RobotFileParser()
                    policy.parse(response.text.splitlines())
                    delay = policy.crawl_delay(USER_AGENT)
                    domain = _domain(url)
                    self.delays[domain] = max(
                        self.delays.get(domain, DEFAULT_DELAY), delay or DEFAULT_DELAY
                    )
                    self.robots[origin] = policy
            return self.robots[origin]

    async def _fetch(self, url: str, *, accept: str) -> httpx.Response:
        for _ in range(6):
            _domain(url)
            policy = await self._robots_for(url)
            if policy is not None and not policy.can_fetch(USER_AGENT, url):
                raise ValueError("Feed URL disallowed by robots.txt")
            response = await self._request(url, accept=accept)
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location:
                    raise ValueError("Redirect is missing Location")
                url = urljoin(str(response.url), location)
                continue
            response.raise_for_status()
            return response
        raise ValueError("Too many feed redirects")

    async def _poll(self, source: Source) -> list[FeedItem]:
        extra = {"source": source.name, "feed_url": source.feed_url}
        try:
            if source.connection_type.lower() not in {"rss", "atom"}:
                raise ValueError("Source is not RSS or Atom")
            response = await self._fetch(
                source.feed_url, accept="application/rss+xml, application/atom+xml"
            )
            try:
                parsed = await asyncio.to_thread(feedparser.parse, response.content)
            except (ValueError, TypeError, LookupError, SAXException):
                parsed = {}
            if not parsed.get("version") or (
                parsed.get("bozo") and not parsed.get("entries")
            ):
                response = await self._fetch(
                    str(response.url), accept="application/xml, text/xml, */*"
                )
                parsed = await asyncio.to_thread(feedparser.parse, response.text)
                if not parsed.get("version") or (
                    parsed.get("bozo") and not parsed.get("entries")
                ):
                    raise ValueError("Response could not be parsed as RSS or Atom")
            items = []
            for entry in parsed.get("entries", []):
                title = html.unescape(str(entry.get("title", ""))).strip()
                link = str(entry.get("link", "")).strip()
                if not title or not link:
                    continue
                link = urljoin(str(response.url), link)
                if urlsplit(link).scheme not in {"http", "https"}:
                    continue
                items.append(
                    FeedItem(
                        title=title,
                        url=link,
                        published_at=_published_at(entry),
                        source_name=source.name,
                        category=source.category,
                        raw_summary=_summary(entry),
                        enclosure_type=_enclosure_type(entry),
                    )
                )
            logger.info("feed_success", extra={**extra, "item_count": len(items)})
            return items
        except (
            httpx.HTTPError,
            ValueError,
            TypeError,
            LookupError,
            SAXException,
        ) as exc:
            logger.error(
                "feed_error", extra={**extra, "error_type": type(exc).__name__}
            )
            return []


def _enclosure_type(entry: dict[str, Any]) -> str | None:
    """Return the first declared audio or video enclosure MIME type."""
    enclosures = [*entry.get("enclosures", []), *entry.get("media_content", [])]
    for enclosure in enclosures:
        media_type = str(enclosure.get("type", "")).strip().casefold()
        if media_type.startswith(("audio/", "video/")):
            return media_type
    return None


def _summary(entry: dict[str, Any]) -> str:
    summary = str(entry.get("summary", ""))
    # Feedparser may synthesize summary from Atom content; never expose that.
    if any(summary == content.get("value") for content in entry.get("content", [])):
        return ""
    return summary


def _published_at(entry: dict[str, Any]) -> datetime | None:
    parsed_date = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed_date is None:
        return None
    try:
        return datetime.fromtimestamp(calendar.timegm(parsed_date), tz=UTC)
    except (ValueError, OverflowError, TypeError):
        return None


async def poll_all_sources(sources: list[Source]) -> list[FeedItem]:
    """Poll feeds concurrently with domain-specific request spacing.

    Args:
        sources: RSS/Atom sources to poll in this batch.

    Returns:
        Feed items in source order. Failed feeds log an error and contribute no
        items. Missing or invalid publication dates are represented by None.
    """
    async with httpx.AsyncClient(
        timeout=20.0, follow_redirects=False, headers={"User-Agent": USER_AGENT}
    ) as client:
        poller = _Poller(client)
        results = await asyncio.gather(*(poller._poll(source) for source in sources))
    return [item for batch in results for item in batch]
