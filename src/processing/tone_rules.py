"""Deterministic editorial labels from evidence signals extracted by the model."""

from dataclasses import dataclass

# Preserve existing label IDs for stored records; append new public labels.
TONES = ("Good", "Useful", "Bad", "Ugly", "Cool", "Neutral")


@dataclass(frozen=True, slots=True)
class ToneDecision:
    """Editorial label, explanation and mandatory review reasons."""

    label: str | None
    reason: str
    review_flags: tuple[str, ...] = ()


def decide_tone(
    signals: list[int], *, confidence: float, disagreement: bool = False
) -> ToneDecision:
    """Apply evidence precedence without treating uncertainty as Neutral.

    Args:
        signals: Evidence codes: 0 demonstrated benefit, 1 practical value,
            2 adverse outcome, 3 serious harm/abuse/deception/recklessness,
            4 creative novelty, 5 newsworthy without established directional
            impact, 6 insufficient evidence, 7 substantial mixed impact.
        confidence: Model confidence in the extracted impact evidence.
        disagreement: Whether sources conflict on the reported event.

    Returns:
        A label or an abstention, with a concise explanation and review flags.

    Raises:
        ValueError: Evidence signals are invalid or duplicated.
    """
    if (
        not isinstance(signals, list)
        or any(type(code) is not int or code not in range(8) for code in signals)
        or len(set(signals)) != len(signals)
    ):
        raise ValueError("Invalid tone evidence signals")
    evidence = set(signals)
    if disagreement:
        return ToneDecision(
            None,
            "Sources conflict; an editor must assess impact.",
            ("source_disagreement",),
        )
    if 7 in evidence or (evidence & {0, 1} and evidence & {2, 3}):
        return ToneDecision(
            None, "Substantial benefits and harms coexist.", ("mixed_impact",)
        )
    if not evidence or 6 in evidence or confidence < 0.8:
        return ToneDecision(
            None, "Evidence is insufficient to determine impact.", ("unclear_impact",)
        )
    rules = (
        (
            3,
            "Ugly",
            "Reported serious harm, abuse, deception or reckless conduct.",
            ("ugly_requires_review",),
        ),
        (2, "Bad", "Reported failure, setback or adverse consequence.", ()),
        (0, "Good", "Evidence of a demonstrated beneficial outcome.", ()),
        (1, "Useful", "An actionable capability, resource or guidance.", ()),
        (4, "Cool", "A concrete creative or novel idea; wider impact is unproven.", ()),
        (
            5,
            "Neutral",
            "Newsworthy development without established positive or negative impact.",
            (),
        ),
    )
    for code, label, reason, flags in rules:
        if code in evidence:
            return ToneDecision(label, reason, flags)
    raise ValueError("Invalid tone evidence signals")
