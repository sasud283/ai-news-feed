"""Offline processing fixtures; OpenAI requests are always intercepted by respx."""

import json
from datetime import UTC, datetime

import pytest
from openai import AsyncOpenAI

from src.ingestion.rss_poller import FeedItem


@pytest.fixture
def item():
    return FeedItem(
        "OpenAI releases a new AI research model",
        "https://news.example/story",
        datetime(2026, 9, 18, 10, tzinfo=UTC),
        "News",
        "Models & Research",
        "Researchers report improved performance on several reasoning benchmarks.",
    )


@pytest.fixture
def payload():
    return {
        "relevant": True,
        "summary": "OpenAI has introduced an AI model with reported gains on reasoning tests.",
        "topics": [0],
        "tone": [0],
        "geography": 0,
        "scores": [0.95, 0.95, 0.95, 0.95],
        "disagreement": False,
    }


@pytest.fixture
def wire_payload():
    return {
        "r": True,
        "s": "OpenAI has introduced an AI model with reported gains on reasoning tests.",
        "t": [{"i": 0, "c": 0.95}],
        "o": [0],
        "tc": 0.95,
        "g": 0,
        "gc": 0.95,
        "rc": 0.95,
        "d": False,
    }


@pytest.fixture
def completion():
    def make(payload, *, finish="stop", refusal=None):
        if "scores" in payload:
            payload = dict(payload)
            scores = payload.pop("scores")
            topic_ids = payload.pop("topics")
            payload["t"] = [
                {
                    "i": topic_id,
                    "c": scores[index] if index < len(scores) else None,
                }
                for index, topic_id in enumerate(topic_ids)
            ]
            offset = len(topic_ids)
            payload["tc"] = scores[offset] if offset < len(scores) else None
            payload["gc"] = scores[offset + 1] if offset + 1 < len(scores) else None
            payload["rc"] = scores[offset + 2] if offset + 2 < len(scores) else None
            payload["r"] = payload.pop("relevant")
            payload["s"] = payload.pop("summary")
            payload["o"] = payload.pop("tone")
            payload["g"] = payload.pop("geography")
            payload["d"] = payload.pop("disagreement")
        return {
            "id": "chatcmpl-test",
            "object": "chat.completion",
            "created": 1,
            "model": "gpt-4o-mini",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": finish,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(payload),
                        "refusal": refusal,
                    },
                }
            ],
            "usage": {
                "prompt_tokens": 400,
                "completion_tokens": 100,
                "total_tokens": 500,
            },
        }

    return make


@pytest.fixture
async def client(respx_mock):
    async with AsyncOpenAI(api_key="test-only", max_retries=0) as api:
        yield api
