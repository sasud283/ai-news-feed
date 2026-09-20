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
def completion():
    def make(payload, *, finish="stop", refusal=None):
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
