"""Access registry coverage and conservative paid-source defaults."""

import json
from dataclasses import replace
from pathlib import Path

from src.processing.access import infer_access_by_url


def test_every_active_source_has_an_access_registry_entry(item):
    root = Path(__file__).resolve().parents[2]
    sources = json.loads((root / "src/ingestion/sources.json").read_text())
    registry = json.loads((root / "src/processing/source_access.json").read_text())
    assert {source["name"] for source in sources} <= set(registry)


def test_mixed_access_source_remains_unknown(item):
    mixed = replace(item, source_name="McKinsey Insights")
    assert mixed.url not in infer_access_by_url([mixed])


def test_paid_and_free_sources_are_distinguished(item):
    paid = replace(item, source_name="Financial Times (AI)")
    free = replace(
        item,
        source_name="The Guardian (AI/Society)",
        url="https://example.com/free",
    )
    access = infer_access_by_url([paid, free])
    assert access[paid.url] == "Paid"
    assert access[free.url] == "Free"
