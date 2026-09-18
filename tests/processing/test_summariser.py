"""Exercise the real SDK transport through mocked HTTP, with strict budgets."""

import json
from dataclasses import replace

import pytest

from src.processing.deduplicator import StoryGroup
from src.processing.summariser import build_prompt, summarise_story, summary_is_copied

URL = "https://api.openai.com/v1/chat/completions"


async def test_combined_request_uses_required_model(
    item, payload, completion, client, respx_mock
):
    route = respx_mock.post(URL).respond(200, json=completion(payload))
    result = await summarise_story(StoryGroup((item,)), client=client)
    assert result.classification.topics == ("Models & Research",)
    assert result.summary == payload["summary"]
    body = json.loads(route.calls[0].request.content)
    assert body["model"] == "gpt-4o-mini"
    assert body["store"] is False
    assert body["max_completion_tokens"] == 400
    assert route.call_count == 1


async def test_prompt_budget_html_and_unicode(item):
    hostile = replace(
        item,
        title="安全 AI " * 500,
        raw_summary="<script>SECRET</script><p>研究 model </p>" * 1000,
    )
    prompt = await build_prompt(StoryGroup((hostile, hostile, hostile, hostile)))
    assert prompt.token_count < 500 and prompt.truncated
    assert "SECRET" not in prompt.evidence and "<script>" not in prompt.evidence
    assert len(json.loads(prompt.evidence)["items"]) == 3
    assert "untrusted evidence" in prompt.instructions


@pytest.mark.parametrize(
    "finish,refusal", [("length", None), ("stop", "Cannot comply")]
)
async def test_refusal_or_truncation_rejected(
    item, payload, completion, client, respx_mock, finish, refusal
):
    respx_mock.post(URL).respond(
        200, json=completion(payload, finish=finish, refusal=refusal)
    )
    with pytest.raises(ValueError):
        await summarise_story(StoryGroup((item,)), client=client)


@pytest.mark.parametrize(
    "change",
    [{"topics": [100]}, {"extra": 1}, {"summary": ""}, {"summary": "word " * 71}],
)
async def test_malformed_payload_rejected(
    item, payload, completion, client, respx_mock, change
):
    payload.update(change)
    respx_mock.post(URL).respond(200, json=completion(payload))
    with pytest.raises(ValueError):
        await summarise_story(StoryGroup((item,)), client=client)


def test_verbatim_passage_detected_inside_long_source(item):
    excerpt = "The research team has reported a surprising breakthrough today in model reasoning."
    source = replace(
        item, raw_summary="Other context. " * 30 + excerpt + " More context." * 30
    )
    assert summary_is_copied(excerpt, StoryGroup((source,)))
    assert not summary_is_copied(
        "There is no overlap in this separate explanation.", StoryGroup((source,))
    )


async def test_missing_excerpt_requires_review(
    item, payload, completion, client, respx_mock
):
    respx_mock.post(URL).respond(200, json=completion(payload))
    result = await summarise_story(
        StoryGroup((replace(item, raw_summary=""),)), client=client
    )
    assert "headline_only_evidence" in result.review_reasons
