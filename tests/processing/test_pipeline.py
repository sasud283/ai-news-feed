"""Cost, failure isolation, media identity, and safe storage handoff checks."""

import json
from dataclasses import asdict, replace

import httpx
import pytest

from src.processing.pipeline import process_items

URL = "https://api.openai.com/v1/chat/completions"


async def test_seen_items_require_no_key_or_api(item, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = await process_items([item], seen_urls={item.url})
    assert not result.stories and result.skipped_urls == (item.url,)


async def test_duplicate_group_costs_one_call_and_retains_sources(
    item, payload, completion, client, respx_mock
):
    route = respx_mock.post(URL).respond(200, json=completion(payload))
    other = replace(item, source_name="Other", url="https://other.example/story")
    result = await process_items(
        [item, other],
        seen_urls=set(),
        client=client,
        access_by_url={item.url: "Paid", other.url: "Free"},
    )
    assert route.call_count == 1 and len(result.stories) == 1
    story = result.stories[0]
    assert len(story.sources) == 2 and story.access == "Free"
    serialized = json.dumps(asdict(result), default=str)
    assert "raw_summary" not in serialized and item.raw_summary not in serialized


async def test_existing_story_gets_source_without_model(item, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    other = replace(item, url="https://other.example/story", source_name="Other")
    result = await process_items(
        [other], seen_urls={item.url}, existing_items=[replace(item, raw_summary="")]
    )
    assert not result.stories
    assert result.source_updates[0].existing_url == item.url
    assert result.source_updates[0].sources[0].source_url == other.url


async def test_failure_is_retryable_and_other_story_succeeds(
    item, payload, completion, client, respx_mock
):
    route = respx_mock.post(URL).mock(
        side_effect=[
            httpx.Response(
                429, json={"error": {"message": "limited", "type": "rate_limit"}}
            ),
            httpx.Response(200, json=completion(payload)),
        ]
    )
    other = replace(
        item, title="AI tools reshape classroom education", url="https://example.com/2"
    )
    result = await process_items([item, other], seen_urls=set(), client=client)
    assert len(result.failures) == 1 and len(result.stories) == 1
    assert result.failures[0].urls == (item.url,)
    assert item.url not in result.skipped_urls + result.rejected_urls
    assert route.call_count == 2


async def test_budget_defers_unprocessed_items(
    item, payload, completion, client, respx_mock
):
    route = respx_mock.post(URL).respond(200, json=completion(payload))
    other = replace(
        item, title="AI regulation passes in parliament", url="https://example.com/2"
    )
    result = await process_items(
        [item, other], seen_urls=set(), client=client, max_new_stories=1
    )
    assert route.call_count == 1 and result.deferred_urls == (other.url,)


async def test_irrelevant_news_filtered(item, payload, completion, client, respx_mock):
    payload.update(relevant=False, topics=[], summary="", scores=[0, 0, 0.99])
    respx_mock.post(URL).respond(200, json=completion(payload))
    result = await process_items([item], seen_urls=set(), client=client)
    assert not result.stories and result.rejected_urls == (item.url,)


async def test_uncertain_relevance_held_for_review(
    item, payload, completion, client, respx_mock
):
    payload.update(relevant=False, topics=[], summary="", scores=[0, 0, 0.5])
    respx_mock.post(URL).respond(200, json=completion(payload))
    result = await process_items([item], seen_urls=set(), client=client)
    assert not result.rejected_urls
    assert "uncertain_relevance" in result.stories[0].review_reasons


async def test_podcast_source_defaults_do_not_merge_episodes(
    item, payload, completion, client, respx_mock
):
    route = respx_mock.post(URL).respond(200, json=completion(payload))
    podcast = replace(item, source_name="Dwarkesh Podcast")
    other = replace(podcast, url="https://example.com/episode2")
    result = await process_items([podcast, other], seen_urls=set(), client=client)
    assert len(result.stories) == 2 and route.call_count == 2
    assert all(story.content_type == "Podcast" for story in result.stories)


async def test_access_unknown_is_reviewed_not_guessed(
    item, payload, completion, client, respx_mock
):
    respx_mock.post(URL).respond(200, json=completion(payload))
    result = await process_items([item], seen_urls=set(), client=client)
    assert result.stories[0].access is None
    assert "unknown_access" in result.stories[0].review_reasons


async def test_invalid_url_does_not_abort_batch(item):
    result = await process_items([replace(item, url="file:///no")], seen_urls=set())
    assert result.failures[0].error_type == "ValueError"


async def test_zero_budget_needs_no_credentials(item, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = await process_items([item], seen_urls=set(), max_new_stories=0)
    assert result.deferred_urls == (item.url,)


@pytest.mark.parametrize(
    "options",
    [
        {"max_new_stories": -1},
        {"review_threshold": 2},
        {"content_types": {"News": "Book"}},
    ],
)
async def test_invalid_config_rejected(item, options):
    with pytest.raises(ValueError):
        await process_items([item], seen_urls=set(), **options)


async def test_json_logs_do_not_include_source_text(
    item, payload, completion, client, respx_mock, monkeypatch
):
    from src.processing import pipeline

    records = []
    monkeypatch.setattr(pipeline.logger, "handle", records.append)
    respx_mock.post(URL).respond(200, json=completion(payload))
    await process_items([item], seen_urls=set(), client=client)
    rendered = pipeline._JsonFormatter().format(records[0])
    assert json.loads(rendered)["event"] == "story_review"
    assert item.raw_summary not in rendered and payload["summary"] not in rendered


async def test_missing_publication_date_requires_review(
    item, payload, completion, client, respx_mock
):
    respx_mock.post(URL).respond(200, json=completion(payload))
    result = await process_items(
        [replace(item, published_at=None)], seen_urls=set(), client=client
    )
    assert "missing_publication_date" in result.stories[0].review_reasons
