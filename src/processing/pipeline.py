"""Phase 2 orchestration; persistence and publishing belong to later phases."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import Collection, Mapping, Sequence
from pathlib import Path

from openai import APIError, AsyncOpenAI

from src.ingestion.rss_poller import FeedItem
from src.processing.classifier import review_reasons
from src.processing.deduplicator import canonical_url, group_items
from src.processing.models import (
    Access,
    ContentType,
    ProcessedStory,
    ProcessingFailure,
    ProcessingResult,
    SourceUpdate,
    StorySource,
)
from src.processing.summariser import MODEL, summarise_story

_VALIDATION_REASONS = {
    "Require one score per topic, then tone, geography, relevance": "score_count_mismatch",
    "Unexpected model response fields": "response_fields_mismatch",
    "Model response incomplete or refused": "incomplete_or_refused",
    "Invalid summary length": "summary_length_invalid",
    "Unknown classification label": "classification_label_invalid",
}


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "event": record.getMessage(),
                "level": record.levelname,
                "url": getattr(record, "story_url", None),
                "error_type": getattr(record, "error_type", None),
                "validation_reason": getattr(record, "validation_reason", None),
                "model": getattr(record, "model", None),
                "model_calls": getattr(record, "model_calls", None),
                "prompt_tokens": getattr(record, "prompt_tokens", None),
                "completion_tokens": getattr(record, "completion_tokens", None),
                "total_tokens": getattr(record, "total_tokens", None),
                "estimated_cost_usd": getattr(record, "estimated_cost_usd", None),
            }
        )


logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

_AI_SIGNAL = re.compile(
    r"\b(?:AI|LLMs?|artificial intelligence|machine learning|deep learning|"
    r"large language models?|foundation models?|neural networks?|computer vision|"
    r"natural language processing|chatbots?|deepfakes?|AI agents?|"
    r"OpenAI|ChatGPT|Anthropic|Claude|DeepMind|Gemini|Mistral|Copilot)\b",
    re.IGNORECASE,
)


def _has_ai_signal(item: FeedItem) -> bool:
    """Return whether the available feed evidence explicitly concerns AI or ML."""
    return bool(_AI_SIGNAL.search(f"{item.title} {item.raw_summary}"))


def _load_types() -> dict[str, ContentType]:
    path = Path(__file__).with_name("source_types.json")
    return json.loads(path.read_text())


def _sources(
    items: Sequence[FeedItem], access: Mapping[str, Access]
) -> tuple[StorySource, ...]:
    return tuple(
        dict.fromkeys(
            StorySource(
                item.source_name,
                canonical_url(item.url),
                access.get(canonical_url(item.url)),
            )
            for item in items
        )
    )


async def process_items(
    items: Sequence[FeedItem],
    *,
    seen_urls: Collection[str],
    existing_items: Sequence[FeedItem] = (),
    content_types: Mapping[str, ContentType] | None = None,
    access_by_url: Mapping[str, Access] | None = None,
    client: AsyncOpenAI | None = None,
    max_new_stories: int = 100,
    review_threshold: float = 0.8,
) -> ProcessingResult:
    """Deduplicate and process new feed items within a bounded request budget.

    Args:
        items: Feed items whose excerpts remain transient.
        seen_urls: URLs already stored or rejected; the storage caller must supply
            this explicitly. Failed/deferred items must not be marked seen.
        existing_items: Recent stored headlines, URLs and dates reconstructed as
            FeedItem values with empty raw_summary; used to attach new sources.
        content_types: Optional source-name overrides; defaults to source_types.json.
        access_by_url: Verified per-article Free/Paid values, not publisher guesses.
        client: Optional caller-owned client. Otherwise use OPENAI_API_KEY from env.
        max_new_stories: Maximum model requests per batch before deferring work.
        review_threshold: Minimum per-tag confidence to avoid editorial review.

    Returns:
        Stories, source additions, skips/rejections, deferred URLs, and failures.
        Nothing is written to a database, published, or marked seen automatically.

    Raises:
        ValueError: Configuration or caller-supplied existing metadata is invalid.
        openai.OpenAIError: No API key is configured when model work is required.
    """
    if type(max_new_stories) is not int or max_new_stories < 0:
        raise ValueError("max_new_stories must be a nonnegative integer")
    if not 0 <= review_threshold <= 1:
        raise ValueError("review_threshold must be between zero and one")
    types = (
        dict(content_types)
        if content_types is not None
        else await asyncio.to_thread(_load_types)
    )
    if any(kind not in {"Article", "Podcast", "Video"} for kind in types.values()):
        raise ValueError("Unknown content type")
    access = {canonical_url(url): value for url, value in (access_by_url or {}).items()}
    if any(value not in {"Free", "Paid"} for value in access.values()):
        raise ValueError("Access must be Free or Paid")
    seen = {canonical_url(url) for url in seen_urls}
    known = {canonical_url(item.url) for item in existing_items}
    seen |= known
    skipped: list[str] = []
    rejected: list[str] = []
    valid: list[FeedItem] = []
    failures: list[ProcessingFailure] = []
    for item in items:
        try:
            url = canonical_url(item.url)
            if not item.title.strip():
                raise ValueError("Empty headline")
        except ValueError:
            failures.append(ProcessingFailure((item.url,), "ValueError"))
            continue
        if url in seen:
            skipped.append(url)
        elif not _has_ai_signal(item):
            rejected.append(url)
            logger.info("no_ai_signal", extra={"story_url": url})
        else:
            valid.append(item)
    # Do not drop repeated URLs in advance: grouping retains attribution aliases.
    groups = await asyncio.to_thread(
        group_items, [*existing_items, *valid], content_types=types
    )
    stories: list[ProcessedStory] = []
    updates: list[SourceUpdate] = []
    deferred: list[str] = []
    calls = 0
    prompt_tokens = 0
    completion_tokens = 0
    owned: AsyncOpenAI | None = None
    try:
        for group in groups:
            urls = tuple(dict.fromkeys(canonical_url(item.url) for item in group.items))
            stored = next((url for url in urls if url in known), None)
            if stored:
                additions = [
                    item for item in group.items if canonical_url(item.url) not in known
                ]
                if additions:
                    updates.append(SourceUpdate(stored, _sources(additions, access)))
                    logger.info("existing_story_sources", extra={"story_url": stored})
                continue
            if calls >= max_new_stories:
                deferred.extend(urls)
                continue
            if client is None:
                # Lazy construction allows dedup-only and empty batches without a key.
                owned = AsyncOpenAI(max_retries=0, timeout=30.0)
                client = owned
            calls += 1
            try:
                analysis = await summarise_story(group, client=client)
            except (APIError, ValueError) as exc:
                failures.append(ProcessingFailure(urls, type(exc).__name__))
                logger.error(
                    "processing_error",
                    extra={
                        "story_url": urls[0],
                        "error_type": type(exc).__name__,
                        "validation_reason": (
                            _VALIDATION_REASONS.get(str(exc), "invalid_model_output")
                            if isinstance(exc, ValueError)
                            else None
                        ),
                    },
                )
                continue
            tags = analysis.classification
            prompt_tokens += analysis.prompt_tokens
            completion_tokens += analysis.completion_tokens
            if not tags.relevant:
                rejected.extend(urls)
                logger.info("irrelevant_story", extra={"story_url": urls[0]})
                continue
            reasons = [
                *analysis.review_reasons,
                *review_reasons(tags, threshold=review_threshold),
            ]
            sources = _sources(group.items, access)
            if any(source.access is None for source in sources):
                reasons.append("unknown_access")
            values = {source.access for source in sources}
            # Free when there is a confirmed free route, Paid only if all are paid.
            match values:
                case values if "Free" in values:
                    aggregate_access: Access | None = "Free"
                case values if values == {"Paid"}:
                    aggregate_access = "Paid"
                case _:
                    aggregate_access = None
            if group.related_to_url:
                reasons.append("possible_follow_up")
            first = group.items[0]
            if first.published_at is None:
                reasons.append("missing_publication_date")
            stories.append(
                ProcessedStory(
                    first.title,
                    urls[0],
                    first.published_at,
                    analysis.summary,
                    tags,
                    sources,
                    group.content_type,
                    aggregate_access,
                    tuple(dict.fromkeys(reasons)),
                    analysis.language,
                    group.related_to_url,
                )
            )
            logger.info(
                "story_review" if reasons else "story_ready",
                extra={"story_url": urls[0]},
            )
    finally:
        if owned is not None:
            await owned.close()
    return ProcessingResult(
        tuple(stories),
        tuple(updates),
        tuple(dict.fromkeys(skipped)),
        tuple(dict.fromkeys(rejected)),
        tuple(dict.fromkeys(deferred)),
        tuple(failures),
        MODEL if calls else None,
        calls,
        prompt_tokens,
        completion_tokens,
    )
