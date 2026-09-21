"""Website taxonomy and strict validation of combined model classifications."""

from collections.abc import Mapping
from math import isfinite
from typing import Any

from src.config import CATEGORIES
from src.processing.models import Classification
from src.processing.tone_rules import TONES, decide_tone

__all__ = ["GEOGRAPHIES", "TONES", "TOPICS", "classify", "review_reasons"]

TOPICS = CATEGORIES
GEOGRAPHIES = (
    "Worldwide",
    "US",
    "China",
    "Europe",
    "Africa",
    "Latin America",
    "South & Southeast Asia",
    "Middle East",
)


def _label(value: Any, labels: tuple[str, ...]) -> str:
    if type(value) is not int or not 0 <= value < len(labels):
        raise ValueError("Unknown classification label")
    return labels[value]


def classify(payload: Mapping[str, Any]) -> Classification:
    """Validate the classification part of a single summary-and-tag response.

    Args:
        payload: Decoded JSON containing numeric taxonomy IDs and scores.

    Returns:
        Typed labels compatible with the current frontend taxonomy.

    Raises:
        ValueError: Types, labels, score counts, or confidence values are invalid.
    """
    if type(payload.get("relevant")) is not bool:
        raise ValueError("Relevance must be a boolean")
    if type(payload.get("disagreement")) is not bool:
        raise ValueError("Disagreement must be a boolean")
    ids = payload.get("topics")
    if not isinstance(ids, list) or len(ids) > len(TOPICS):
        raise ValueError("Invalid topic list")
    topics = tuple(_label(index, TOPICS) for index in ids)
    if len(set(topics)) != len(topics):
        raise ValueError("Duplicate topic IDs")
    relevant = payload["relevant"]
    if relevant and not topics:
        raise ValueError("Relevant stories require a topic")
    if not relevant and topics:
        raise ValueError("Irrelevant stories must have no topics")
    geography = _label(payload.get("geography"), GEOGRAPHIES) if relevant else None
    scores = payload.get("scores")
    if not isinstance(scores, list) or len(scores) != len(topics) + 3:
        raise ValueError("Require one score per topic, then tone, geography, relevance")
    if any(
        type(score) not in {int, float} or not isfinite(score) or not 0 <= score <= 1
        for score in scores
    ):
        raise ValueError("Confidence must be finite and between zero and one")
    decision = (
        decide_tone(
            payload.get("tone"),
            confidence=float(scores[-3]),
            disagreement=payload["disagreement"],
        )
        if relevant
        else None
    )
    return Classification(
        relevant,
        topics,
        decision.label if decision else None,
        geography,
        tuple(float(s) for s in scores[:-3]),
        float(scores[-3]),
        float(scores[-2]),
        float(scores[-1]),
        payload["disagreement"],
        decision.reason if decision else None,
        decision.review_flags if decision else (),
    )


def review_reasons(
    classification: Classification, *, threshold: float = 0.8
) -> tuple[str, ...]:
    """Flag uncertain model output for editorial review.

    Args:
        classification: Validated model output.
        threshold: Minimum confidence accepted for each independent label.

    Returns:
        Stable review reason codes, empty for confident, consistent output.

    Raises:
        ValueError: The threshold is outside zero to one.
    """
    if not 0 <= threshold <= 1:
        raise ValueError("Confidence threshold must be between zero and one")
    reasons = []
    if any(score < threshold for score in classification.topic_confidence):
        reasons.append("low_topic_confidence")
    for name in ("tone", "geography", "relevance"):
        if getattr(classification, f"{name}_confidence") < threshold:
            reasons.append(f"low_{name}_confidence")
    if classification.disagreement:
        reasons.append("source_disagreement")
    return tuple(dict.fromkeys([*reasons, *classification.tone_flags]))
