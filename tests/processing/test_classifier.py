"""Validate the website taxonomy and independent confidence checks."""

from pathlib import Path
import re

import pytest

from src.processing.classifier import (
    TOPICS,
    TONES,
    GEOGRAPHIES,
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
        block = re.search(rf"export const {name}:.*?= \[(.*?)\];", text, re.S).group(1)
        assert tuple(re.findall(r'"([^"]+)"', block)) == labels


def test_multiple_topics_and_per_tag_confidence(payload):
    payload.update(topics=[3, 5], scores=[0.95, 0.4, 0.95, 0.95, 0.95])
    result = classify(payload)
    assert result.topics == ("National Initiatives", "Future of Work")
    assert review_reasons(result) == ("low_topic_confidence",)


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
