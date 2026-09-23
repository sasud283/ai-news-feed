"""Deterministic, offline coverage of RSS ingestion and request pacing."""

import asyncio
import json
import logging
from dataclasses import replace
from datetime import UTC, datetime
from itertools import pairwise

import httpx
import pytest
import respx

from src.ingestion import rss_poller as poller

RSS = """<?xml version="1.0"?>
<rss version="2.0"><channel><title>News</title><link>https://example.org</link>
<description>News</description><item><title>New model</title>
<link>https://example.org/article</link>
<pubDate>Fri, 18 Sep 2026 10:00:00 GMT</pubDate>
<description>Publisher excerpt</description></item></channel></rss>"""
PODCAST_RSS = RSS.replace(
    "<description>Publisher excerpt</description>",
    "<description>Podcast #19</description>"
    '<enclosure url="https://cdn.example.org/episode.mp3" type="audio/mpeg" />',
)

ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><title>News</title>
<id>urn:news</id><updated>2026-09-18T10:00:00Z</updated><entry>
<title>Atom story</title><id>urn:story</id><link href="https://example.org/atom"/>
<updated>2026-09-18T10:00:00Z</updated><summary>Short excerpt</summary>
<content>Full article must not be returned</content></entry></feed>"""


@pytest.fixture
def source() -> poller.Source:
    return poller.Source(
        name="Example",
        url="https://example.org",
        feed_url="https://example.org/feed",
        category="Models & Research",
        region="Global",
        connection_type="rss",
        notes="",
    )


@pytest.fixture
def clock(monkeypatch):
    state = {"now": 100.0, "sleeps": []}

    async def sleep(delay):
        state["sleeps"].append(delay)
        state["now"] += delay

    monkeypatch.setattr(poller.time, "monotonic", lambda: state["now"])
    monkeypatch.setattr(poller.asyncio, "sleep", sleep)
    return state


@pytest.fixture
def routes():
    with respx.mock(assert_all_called=False) as router:
        router.get("https://example.org/robots.txt").respond(404)
        yield router


async def test_poll_single_source_returns_items(source, routes, clock):
    routes.get(source.feed_url).respond(200, text=RSS)
    items = await poller.poll_all_sources([source])
    assert items == [
        poller.FeedItem(
            title="New model",
            url="https://example.org/article",
            published_at=datetime(2026, 9, 18, 10, tzinfo=UTC),
            source_name="Example",
            category="Models & Research",
            raw_summary="Publisher excerpt",
        )
    ]


async def test_html_entities_in_title_are_decoded(source, routes, clock):
    routes.get(source.feed_url).respond(
        200,
        text=RSS.replace(
            "<title>New model</title>",
            "<title>Anthropic&amp;#8217;s model</title>",
        ),
    )
    item = (await poller.poll_all_sources([source]))[0]
    assert item.title == "Anthropic’s model"


async def test_audio_enclosure_is_preserved(source, routes, clock):
    routes.get(source.feed_url).respond(200, text=PODCAST_RSS)
    item = (await poller.poll_all_sources([source]))[0]
    assert item.enclosure_type == "audio/mpeg"


async def test_rate_limit_respected(source, routes, clock):
    starts = []

    def respond(request):
        starts.append(clock["now"])
        return httpx.Response(200, text=RSS)

    routes.get(source.feed_url).mock(side_effect=respond)
    assert len(await poller.poll_all_sources([source, source, source])) == 3
    assert all(b - a >= 2.0 for a, b in pairwise(starts))
    assert clock["sleeps"] == [2.0, 2.0, 2.0]


@pytest.mark.parametrize(
    "url", ["not a URL", "file:///etc/passwd", "ftp://example.org"]
)
async def test_bad_url_handled_gracefully(source, routes, url):
    assert await poller.poll_all_sources([replace(source, feed_url=url)]) == []
    assert not routes.calls


async def test_crawl_delay_respected(source, routes, clock):
    routes.get("https://example.org/robots.txt").respond(
        200, text="User-agent: *\nCrawl-delay: 5\n"
    )
    routes.get(source.feed_url).respond(200, text=RSS)
    assert len(await poller.poll_all_sources([source, source])) == 2
    assert clock["sleeps"] == [5.0, 5.0]


async def test_failed_feed_does_not_hide_success(source, routes, clock):
    routes.get(source.feed_url).respond(503)
    routes.get("https://example.org/working").respond(200, text=RSS)
    items = await poller.poll_all_sources(
        [source, replace(source, feed_url="https://example.org/working")]
    )
    assert len(items) == 1


async def test_httpx_fallback(source, routes, clock):
    route = routes.get(source.feed_url).mock(
        side_effect=[
            httpx.Response(200, text="<html>Temporarily unavailable</html>"),
            httpx.Response(200, text=RSS),
        ]
    )
    assert len(await poller.poll_all_sources([source])) == 1
    assert route.call_count == 2
    assert clock["sleeps"] == [2.0, 2.0]
    assert route.calls[1].request.headers["accept"] == "application/xml, text/xml, */*"


async def test_invalid_feed_logs_error(source, routes, clock, monkeypatch):
    records = []
    monkeypatch.setattr(poller.logger, "handle", records.append)
    route = routes.get(source.feed_url).respond(200, text="<html>Not a feed</html>")
    assert await poller.poll_all_sources([source]) == []
    assert route.call_count == 2
    log = json.loads(poller.JsonFormatter().format(records[0]))
    assert log["event"] == "feed_error"
    assert log["source"] == source.name
    assert log["error_type"] == "ValueError"


async def test_atom_and_success_log(source, routes, clock, monkeypatch):
    records = []
    monkeypatch.setattr(poller.logger, "handle", records.append)
    routes.get(source.feed_url).respond(200, text=ATOM)
    items = await poller.poll_all_sources([source])
    assert items[0].title == "Atom story"
    assert items[0].raw_summary == "Short excerpt"
    log = json.loads(poller.JsonFormatter().format(records[0]))
    assert log["event"] == "feed_success"
    assert log["item_count"] == 1
    assert records[0].levelno == logging.INFO


async def test_empty_feed_is_success(source, routes, clock):
    route = routes.get(source.feed_url).respond(
        200, text='<rss version="2.0"><channel><title>Empty</title></channel></rss>'
    )
    assert await poller.poll_all_sources([source]) == []
    assert route.call_count == 1


async def test_timeout_is_isolated(source, routes, clock):
    routes.get(source.feed_url).mock(side_effect=httpx.ReadTimeout("timed out"))
    assert await poller.poll_all_sources([source]) == []


async def test_robots_disallow(source, routes, clock):
    routes.get("https://example.org/robots.txt").respond(
        200, text="User-agent: *\nDisallow: /feed\n"
    )
    feed = routes.get(source.feed_url).respond(200, text=RSS)
    assert await poller.poll_all_sources([source]) == []
    assert not feed.called


async def test_redirect_is_rate_limited(source, routes, clock):
    routes.get(source.feed_url).respond(302, headers={"Location": "/new"})
    routes.get("https://example.org/new").respond(200, text=RSS)
    assert len(await poller.poll_all_sources([source])) == 1
    assert clock["sleeps"] == [2.0, 2.0]


async def test_domains_can_poll_concurrently(source, routes):
    ready = asyncio.Event()
    count = 0

    async def respond(request):
        nonlocal count
        count += 1
        if count == 2:
            ready.set()
        await asyncio.wait_for(ready.wait(), timeout=1)
        return httpx.Response(404)

    routes.get("https://example.org/robots.txt").mock(side_effect=respond)
    routes.get("https://other.org/robots.txt").mock(side_effect=respond)
    # Feed requests fail immediately after their rate-limited robots requests.
    routes.get(source.feed_url).respond(503)
    routes.get("https://other.org/feed").respond(503)
    assert (
        await poller.poll_all_sources(
            [source, replace(source, feed_url="https://other.org/feed")]
        )
        == []
    )
    assert count == 2


async def test_content_only_atom_does_not_expose_body(source, routes, clock):
    routes.get(source.feed_url).respond(
        200, text=ATOM.replace("<summary>Short excerpt</summary>", "")
    )
    items = await poller.poll_all_sources([source])
    assert items[0].raw_summary == ""


async def test_missing_date_is_none(source, routes, clock):
    routes.get(source.feed_url).respond(
        200, text=RSS.replace("<pubDate>Fri, 18 Sep 2026 10:00:00 GMT</pubDate>", "")
    )
    assert (await poller.poll_all_sources([source]))[0].published_at is None
