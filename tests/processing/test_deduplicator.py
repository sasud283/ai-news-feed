"""Avoid duplicate charges without combining unrelated events or episodes."""

from dataclasses import replace
from datetime import timedelta

import pytest

from src.processing.deduplicator import canonical_url, group_items


def test_tracking_removed_but_story_parameters_preserved():
    assert (
        canonical_url("https://EXAMPLE.com:443/news?id=2&utm_source=x#top")
        == "https://example.com/news?id=2"
    )
    assert canonical_url("https://example.com/news?id=1") != canonical_url(
        "https://example.com/news?id=2"
    )
    assert canonical_url("https://example.com/A") != canonical_url(
        "https://example.com/a"
    )


@pytest.mark.parametrize(
    "url", ["bad", "file:///article", "https://user:secret@example.com/a"]
)
def test_invalid_urls_rejected(url):
    with pytest.raises(ValueError):
        canonical_url(url)


def test_same_url_retains_attribution_without_repeating_source(item):
    alias = replace(item, source_name="Syndicated", url=item.url + "?utm_source=rss")
    groups = group_items([item, item, alias])
    assert len(groups) == 1
    assert [i.source_name for i in groups[0].items] == ["News", "Syndicated"]


def test_same_headline_across_publishers_groups(item):
    other = replace(item, url="https://other.example/report", source_name="Other")
    assert len(group_items([item, other])) == 1


def test_different_companies_numbers_and_negation_not_merged(item):
    originals = [
        "Alpha AI raises 10 million in new funding round",
        "Beta AI raises 10 million in new funding round",
        "Alpha AI raises 20 million in new funding round",
        "Alpha AI does not raise 10 million in new funding round",
    ]
    assert (
        len(
            group_items(
                [
                    replace(item, title=t, url=f"https://example.com/{n}")
                    for n, t in enumerate(originals)
                ]
            )
        )
        == 4
    )


def test_old_or_undated_headlines_not_merged(item):
    later = replace(
        item,
        url="https://example.com/later",
        published_at=item.published_at + timedelta(days=4),
    )
    undated = replace(item, url="https://example.com/unknown", published_at=None)
    assert len(group_items([item, later, undated])) == 3


@pytest.mark.parametrize("kind", ["Podcast", "Video"])
def test_episodes_with_same_title_remain_separate(item, kind):
    other = replace(item, url="https://example.com/episode2")
    assert len(group_items([item, other], content_types={"News": kind})) == 2


def test_correction_links_without_merging(item):
    correction = replace(
        item, title="Correction: " + item.title, url="https://example.com/correction"
    )
    groups = group_items([item, correction])
    assert len(groups) == 2
    assert groups[1].related_to_url == item.url


def test_near_duplicate_word_order(item):
    left = replace(item, title="OpenAI today releases a new research model")
    right = replace(
        item,
        title="OpenAI releases today a new research model",
        url="https://other.example/new",
    )
    assert len(group_items([left, right])) == 1


def test_entity_roles_not_reversed(item):
    left = replace(
        item, title="OpenAI acquires Microsoft in a major AI industry acquisition"
    )
    right = replace(
        item,
        title="Microsoft acquires OpenAI in a major AI industry acquisition",
        url="https://other.example/acquisition",
    )
    assert len(group_items([left, right])) == 2


def test_different_currencies_not_merged(item):
    left = replace(item, title="Acme AI raises $10 million in a new funding round")
    right = replace(
        item,
        title="Acme AI raises €10 million in a new funding round",
        url="https://other.example/funding",
    )
    assert len(group_items([left, right])) == 2
