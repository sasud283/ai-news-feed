"""Editorial rules depend on reported impact, not sentiment or identity."""

import pytest

from src.processing.tone_rules import decide_tone


@pytest.mark.parametrize(
    "signals,label",
    [
        ([0], "Good"),
        ([1], "Useful"),
        ([2], "Bad"),
        ([3], "Ugly"),
        ([4], "Cool"),
        ([5], "Neutral"),
        ([0, 1, 4], "Good"),
        ([1, 4], "Useful"),
        ([2, 4], "Bad"),
        ([3, 4], "Ugly"),
    ],
)
def test_evidence_precedence(signals, label):
    assert decide_tone(signals, confidence=0.95).label == label


@pytest.mark.parametrize("signals", [[], [6], [7], [0, 2], [1, 3], [5, 6]])
def test_uncertainty_and_mixed_impact_never_become_neutral(signals):
    decision = decide_tone(signals, confidence=0.95)
    assert decision.label is None
    assert decision.review_flags


def test_ugly_always_requires_editor():
    assert decide_tone([3], confidence=1).review_flags == ("ugly_requires_review",)


def test_neutral_requires_positive_evidence_and_confidence():
    assert decide_tone([5], confidence=0.5).label is None
    assert decide_tone([5], confidence=0.95, disagreement=True).label is None
    assert decide_tone([5], confidence=0.95).review_flags == ()


@pytest.mark.parametrize("signals", [[True], [8], [-1], [0, 0], "Good", 0])
def test_bad_signals_are_rejected(signals):
    with pytest.raises(ValueError):
        decide_tone(signals, confidence=0.95)
