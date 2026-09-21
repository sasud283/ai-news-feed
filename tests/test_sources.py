"""Validate the expanded source inventory without live network access."""

import json
from pathlib import Path
from urllib.parse import urlsplit

from src.ingestion.rss_poller import Source

ROOT = Path(__file__).parents[1]
FIELDS = {"name", "url", "feed_url", "category", "region", "connection_type", "notes"}


def _read(path: str):
    return json.loads((ROOT / path).read_text())


def test_registry_schema_and_unique_feeds():
    active = _read("src/ingestion/sources.json")
    pending = _read("src/ingestion/sources-pending.json")
    assert active and pending
    names = [s["name"] for s in active + pending]
    assert len(names) == len(set(names))
    feeds = [s["feed_url"] for s in active + pending if s["feed_url"]]
    assert len(feeds) == len(set(feeds))
    for row in active + pending:
        assert set(row) == FIELDS
        assert all(isinstance(value, str) for value in row.values())
        Source(**row)
        for key in ("url", "feed_url"):
            if row[key]:
                parsed = urlsplit(row[key])
                assert parsed.scheme in {"http", "https"} and parsed.netloc
    for row in active:
        assert row["connection_type"] in {"rss", "atom"}
        assert row["feed_url"]


def test_verification_controls_polling_registry():
    active = {s["name"]: s for s in _read("src/ingestion/sources.json")}
    pending = {s["name"]: s for s in _read("src/ingestion/sources-pending.json")}
    audit = _read("docs/sources/verification.json")["sources"]
    assert {r["name"] for r in audit} == set(active) | set(pending)
    for row in audit:
        verified = row["verification"]["status"] == "verified"
        assert (row["name"] in active) == verified
        registry = active if verified else pending
        assert registry[row["name"]]["feed_url"] == row["feed_url"]
        assert row["registry"] == (
            "sources.json" if verified else "sources-pending.json"
        )


def test_supplied_sources_and_topic_coverage_are_preserved():
    audit = _read("docs/sources/verification.json")["sources"]
    supplied = [s for row in audit for s in row["supplied_entries"]]
    # Includes cross-listings; deduplication must not drop their metadata.
    assert len(supplied) == 133
    assert {topic for row in audit for topic in row["topics"]} == {
        "Cross-Topic AI Specialist Sources",
        "Models & Research",
        "Ethics & Responsible AI",
        "Policy & Regulation",
        "Leadership",
        "Organisations",
        "People & Jobs",
        "Future of Daily Life",
        "Tools & Products",
        "Business & Industry",
        "Geopolitics of AI",
        "AI Equity & Representation",
        "Mainstream / General Press",
        "AI for Good / Tech for Good",
    }
    for row in audit:
        for source in row["supplied_entries"]:
            assert source["category"] in row["topics"]
    assert {r["name"] for r in audit if r["content_type"] == "podcast"} == {
        "Dwarkesh Podcast",
        "Latent Space",
        "The Cognitive Revolution",
        "No Priors",
        "The AI Daily Brief",
        "Machine Learning Street Talk",
        "The TWIML AI Podcast",
        "NVIDIA AI Podcast",
    }
    assert {r["name"] for r in audit if r["content_type"] == "video"} == {
        "Two Minute Papers",
        "AI Explained",
        "Matt Wolfe",
        "Wes Roth",
        "Fireship",
        "Yannic Kilcher",
        "One-off documentaries",
    }


def test_cross_topic_articles_are_listed_first():
    sources = _read("src/ingestion/sources.json")
    audit = {r["name"]: r for r in _read("docs/sources/verification.json")["sources"]}
    cross_topic_articles = [
        s
        for s in sources
        if s["category"] == "Cross-Topic AI Specialist Sources"
        and audit[s["name"]]["content_type"] == "article"
    ]
    assert len(cross_topic_articles) == 13
    assert sources[:13] == cross_topic_articles


def test_manual_and_excluded_sources_are_not_polled():
    pending = {s["name"]: s for s in _read("src/ingestion/sources-pending.json")}
    assert pending["Bloomberg Technology"]["connection_type"] == "excluded"
    assert pending["AI Ethics Brief (Montreal AI Ethics)"]["connection_type"] == "email"
    assert pending["One-off documentaries"]["connection_type"] == "manual"
    assert pending["Chain of Thought"]["feed_url"] == ""
