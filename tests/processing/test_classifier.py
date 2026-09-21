"""Validate the website taxonomy and independent confidence checks."""

import re
from pathlib import Path

import pytest

from src.processing.classifier import (
    GEOGRAPHIES,
    TONES,
    TOPICS,
    classify,
    review_reasons,
)


def test_labels_match_frontend():
    text = (Path(__file__).parents[2] / "src/lib/news.ts").read_text()
    for name, labels in [
        ("TOPICS", TOPICS),
        ("TONES", TONES),
        ("GEOGRAPHIES", GEOGRAPHIES),
    ]:
        source = (
            (Path(__file__).parents[2] / "src/lib/taxonomy.ts").read_text()
            if name == "TOPICS"
            else text
        )
        block = re.search(
            rf"export const {name}.*?= \[(.*?)\]", source, re.DOTALL
        ).group(1)
        assert tuple(re.findall(r'"([^"]+)"', block)) == labels


def test_multiple_topics_and_per_tag_confidence(payload):
    payload.update(topics=[3, 5], scores=[0.95, 0.4, 0.95, 0.95, 0.95])
    result = classify(payload)
    assert result.topics == ("National Initiatives", "Leadership")
    assert review_reasons(result) == ("low_topic_confidence",)


def test_bilateral_story_accepts_two_geographies(payload):
    payload["geography"] = [1, 2]
    result = classify(payload)
    assert result.geography == "US"
    assert result.secondary_geography == "China"


@pytest.mark.parametrize(
    "change",
    [
        {"topics": [99]},
        {"topics": [True]},
        {"topics": [0, 0]},
        {"topics": []},
        {"scores": [1, 1, 1, float("nan")]},
        {"scores": [1, 1, 1, 1.1]},
        {"scores": [True, 1, 1, 1]},
        {"scores": [1]},
        {"tone": "Good"},
        {"geography": -1},
        {"geography": [1, 1]},
        {"geography": [0, 2]},
        {"geography": [1, 2, 3]},
        {"relevant": "true"},
        {"disagreement": "false"},
    ],
)
def test_bad_classification_rejected(payload, change):
    payload.update(change)
    with pytest.raises(ValueError):
        classify(payload)


def test_disagreement_and_low_confidence_are_reviewed(payload):
    payload.update(scores=[0.9, 0.6, 0.5, 0.4], disagreement=True)
    assert set(review_reasons(classify(payload))) == {
        "low_tone_confidence",
        "low_geography_confidence",
        "low_relevance_confidence",
        "source_disagreement",
    }


def test_irrelevant_content_has_no_topic(payload):
    payload.update(relevant=False, topics=[], scores=[0, 0, 0.99])
    result = classify(payload)
    assert result.relevant is False and result.topics == () and result.tone is None


def test_ugly_and_mixed_evidence_propagate_review_flags(payload):
    payload["tone"] = [3]
    classification = classify(payload)
    assert classification.tone == "Ugly"
    assert "ugly_requires_review" in review_reasons(classification)
    payload["tone"] = [0, 2]
    classification = classify(payload)
    assert classification.tone is None
    assert "mixed_impact" in review_reasons(classification)
    assert classification.tone_reason
