# Editorial impact labels

These labels describe the reported development, not the writing's sentiment,
political stance, publisher, company, or country. Balanced coverage is not evidence
of neutral impact. Promotional claims are not demonstrated outcomes.

| Label | Required basis |
| --- | --- |
| Good | Demonstrated beneficial outcome for people, society, or scientific understanding. |
| Useful | Actionable capability, resource, or guidance. A launch alone does not qualify. |
| Cool | Concrete creative novelty with broader impact unproven. Hype is not evidence. |
| Neutral | Newsworthy event without an established positive or negative impact. |
| Bad | Documented failure, setback, or adverse consequence. |
| Ugly | Serious harm, abuse, deception, rights violations, or reckless conduct. Always reviewed. |

## Decision process

GPT-4o-mini extracts **main-event evidence signals** into the strict response's
`tone` integer array, rather than choosing the final label. Signal codes are
0 demonstrated benefit, 1 practical value, 2 adverse outcome, 3 serious harm or
abuse/deception/recklessness, 4 creative novelty, 5 neutral newsworthiness,
6 insufficient evidence, and 7 substantial mixed impact. The code applies the
rules in `src/processing/tone_rules.py` deterministically:

- Source disagreement, insufficient evidence, or confidence below 0.8 means
  no automatic label; the item enters review. Neutral is not an uncertainty fallback.
- Substantial benefit/practical-value and harm signals together, or an explicit
  mixed-impact signal, mean no automatic label and mandatory review.
- Otherwise: Ugly, then Bad, then Good, then Useful, then Cool, then Neutral.
  Novelty cannot override documented harm. Ugly always requires an editor.
- Explanations and review flags are stored alongside classification metadata and
  displayed in the review card. The editor selects the final label before publication.

Evidence extraction still depends on the model and limited RSS evidence; these
rules do not independently verify facts. Prompts remain below 500 locally counted
tokens including the strict schema. Truncation remains a review reason.

## Initial reassessment

On the user's instruction, both previously published stories were changed to
Neutral while remaining published. Their previous labels and reasons are stored
in `processing_metadata.tone_reassessment`, preserving the original classification.
The financing story was reassessed from its stored summary; the full FT article
was inaccessible. The policy story was reassessed using the publisher article.
No original article text was stored. The changes are editorial decisions under
these rules, not automatic model-confidence claims.

Migration `0005_editorial_tones.sql` adds Cool and Neutral to the live database enum.
Frontend filters, cards, review controls, and the About page support all six labels.
Generated Supabase integration files remain untouched; local frontend types extend
those generated definitions until they are refreshed from the live schema.
