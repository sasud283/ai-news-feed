"""Typed processing results; returned stories never contain publisher excerpts."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

ContentType = Literal["Article", "Podcast", "Video"]
Access = Literal["Free", "Paid"]


@dataclass(frozen=True, slots=True)
class Classification:
    """Validated topic, tone, geography, relevance and per-tag confidence."""

    relevant: bool
    topics: tuple[str, ...]
    tone: str | None
    geography: str | None
    topic_confidence: tuple[float, ...]
    tone_confidence: float
    geography_confidence: float
    relevance_confidence: float
    disagreement: bool
    tone_reason: str | None = None
    tone_flags: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class StorySource:
    """Attribution metadata; unknown access must not be presented as free."""

    source_name: str
    source_url: str
    access: Access | None = None


@dataclass(frozen=True, slots=True)
class ProcessedStory:
    """A new grouped story ready for storage or editorial review."""

    headline: str
    url: str
    published_at: datetime | None
    ai_generated_summary: str
    classification: Classification
    sources: tuple[StorySource, ...]
    content_type: ContentType
    access: Access | None
    review_reasons: tuple[str, ...]
    related_to_url: str | None = None


@dataclass(frozen=True, slots=True)
class SourceUpdate:
    """New source links for an already processed story; no repeat model call."""

    existing_url: str
    sources: tuple[StorySource, ...]
    review_reasons: tuple[str, ...] = ("new_source_requires_review",)


@dataclass(frozen=True, slots=True)
class ProcessingFailure:
    """Safe retry metadata, excluding publisher text and API error bodies."""

    urls: tuple[str, ...]
    error_type: str


@dataclass(frozen=True, slots=True)
class ProcessingResult:
    """Batch results for the future storage adapter to persist transactionally."""

    stories: tuple[ProcessedStory, ...]
    source_updates: tuple[SourceUpdate, ...]
    skipped_urls: tuple[str, ...]
    rejected_urls: tuple[str, ...]
    deferred_urls: tuple[str, ...]
    failures: tuple[ProcessingFailure, ...]
