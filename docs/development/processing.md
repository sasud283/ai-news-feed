# Phase 2: processing

The processing pipeline accepts Phase 1 FeedItem objects, groups duplicate articles,
then uses one GPT-4o-mini request per new group for AI relevance, topic/tone/geography
classification and a fresh summary. It returns typed results for Phase 3 storage.
It does not write stories to Supabase or publish to the website.

## Files

| Path | Responsibility |
| --- | --- |
| `src/processing/deduplicator.py` | URL normalization, local grouping, potential follow-up links |
| `src/processing/classifier.py` | Website taxonomy, strict response validation, confidence flags |
| `src/processing/summariser.py` | Prompt budget, async OpenAI request, copying check |
| `src/processing/pipeline.py` | New-item handling, request budget, failures, storage handoff |
| `src/processing/models.py` | Typed results without publisher excerpts |
| `src/processing/source_types.json` | Podcast/video source identities; other sources default to Article |
| `tests/processing/` | Offline unit and mocked SDK integration tests |

## Setup and verification

Run from the repository root with Python 3.11+:

```sh
source .venv/bin/activate
TMPDIR="$PWD/.tmp" python -m pip install --cache-dir .cache/pip -r requirements-dev.txt
ruff check src/ingestion/ src/processing/
BLACK_CACHE_DIR="$PWD/.cache/black" black --check src/ingestion/ src/processing/ tests/
python -m pytest tests/ -v
```

Live processing requires OPENAI_API_KEY in the process environment. The Python
worker does not automatically load the frontend's .env file. Configure the key in
your local process or deployment secret settings; .env.example documents the name.
Tests use a dummy key and mocked HTTP; they make no paid model requests.
Tiktoken downloads its tokenizer vocabulary on first use and caches it under
`.cache/tiktoken/` inside the repository. Warm this cache before running fully
offline tests. No article, audio or video files are downloaded by processing.

## Calling the pipeline

```python
from src.processing.pipeline import process_items

# feed_items is the result from poll_all_sources(...).
# Storage integration must supply previously processed URLs on every run.
result = await process_items(
    feed_items,
    seen_urls=stored_urls,
    existing_items=recent_story_metadata,
    access_by_url=verified_article_access,
    max_new_stories=100,
    review_threshold=0.8,
)
```

For an initial empty store, pass `seen_urls=set()` and omit existing_items.
Do not pass an empty set on every scheduled run: until Phase 3 provides persisted
state, separate runs would otherwise repeat model work. Existing metadata consists
of FeedItem objects containing stored headlines/URLs/dates and an empty raw_summary;
include recent source URLs as well as canonical story URLs. Across-run deduplication
is only as complete as the caller's supplied history. Run batches sequentially;
there is no distributed claim/lock layer yet.

Use source_types.json or pass content_types to identify Podcast/Video sources.
When adding or renaming a media source, update this mapping too. The source registry
remains on its seven-field schema. The model does not guess media type.

## Storage handoff

- `stories`: new summaries, validated tags, per-tag confidence, source links,
  per-source access, content type, and review reasons. Publisher excerpts are absent.
- `source_updates`: additional sources for an existing story, without a repeat model
  call. These carry `new_source_requires_review`; the storage adapter must preserve
  the existing summary and route changed attribution for review.
- `skipped_urls`: already processed URLs, using canonical URL matching.
- `rejected_urls`: confidently unrelated to AI; can be recorded as processed.
- `deferred_urls`: beyond the batch budget; retry later and do not mark seen.
- `failures`: safe URL/error-type metadata for retry; no source text or API response
  bodies. Failed items are not marked processed.

Store successfully handled URLs only after a successful transaction. Only stories
with no review reasons should be eligible for automatic publication. All review
reasons must be routed to the review queue; low-confidence irrelevant items have an
empty summary and no topic and must not be published. This is a typed processing
handoff, not a Supabase insert payload; Phase 3 must map it to the existing tables.
The database currently requires non-null access/tone/geography, so unresolved values
must be held for review before creating a public story, not coerced to defaults.

`related_to_url` identifies a possible follow-up, not a confirmed correction ID.
The storage/review layer must confirm the relationship before setting is_correction_of.
Mixed-access groups keep every source's access; aggregate access is Free if a verified
free link exists, Paid only if all sources are confirmed paid, otherwise unknown.
Missing access is a review flag. A feed snippet alone does not prove the article is
free, and a publisher with some paywalls does not prove every article is paid.

## Deduplication and quality limits

Exact URLs merge after removing fragments and known tracking parameters; content
query parameters, path case, and HTTP/HTTPS distinctions are retained. Cross-publisher
article grouping uses a 72-hour window and conservatively matches equivalent
headlines with identical words/facts, with difflib handling minor order changes.
Different entities, numbers, currencies and negation stay separate. Undated items
only match by exact URL. Podcasts and videos only merge when their URLs match.
Explicit correction/update headlines can be linked without being merged.

This deliberately follows the Codex spec's lightweight difflib approach. It is not
the semantic embedding/LLM-confirmation design suggested in the broader product PDF:
paraphrased headlines can remain separate and some duplicates will need later review.
Same-URL article revisions are skipped once seen; content-version tracking is future
work. Follow-up matching is conservative and input-order dependent.

The model uses the website's nine topics and the four tone/eight geography labels.
Source categories are not assigned directly to stories: a cross-topic publication
can produce any topic, and a publisher's location is not the story's geography.
The API returns JSON; strict local validation rejects malformed labels, duplicate
IDs, invalid confidence values, missing summaries and overlong summaries.
Confidence is model-reported, not calibrated probability. Real editorial quality
requires evaluation on representative stories before unattended publishing.

Review flags cover low confidence, model-reported source disagreement, excerpt
truncation, title-only evidence, missing dates, unknown access, possible follow-ups,
and summaries that copy an eight-word passage or are highly similar to an excerpt.
Copying detection is a heuristic and does not validate every factual claim.

## Cost controls and implementation choices

- Fixed model: `gpt-4o-mini`, confirmed by the user. The PDF's Claude suggestion is
  superseded for this implementation; no Anthropic calls or embedding calls are made.
- One combined classification-and-summary call per new grouped story. No separate
  model call for each topic or source. High-confidence non-AI results are discarded.
- Locally counted prompt budget: at most 499 tokens, including serialized message
  and JSON-mode configuration plus a framing allowance. Provider billing may count
  framing differently. The instruction is retained; source text is shortened to fit.
- At most three sources enter the prompt; all sources remain in the returned
  attribution list. Omitted or shortened evidence always triggers review. The input
  cap limits multi-source nuance and should be revisited only with explicit approval.
- Output capped at 400 tokens; summaries capped at 70 words. Refusals and truncated
  outputs become retryable failures, never fabricated fallback summaries.
- Batch default: at most 100 requests, sequentially; excess stories are deferred.
  The owned SDK client has a 30-second timeout and retries disabled. Caller-injected
  clients should also disable retries if an exact HTTP request cap is required.
- API response storage is disabled (`store=False`). This does not override the API
  provider's general data-handling policy. Logs contain event, URL, and error type,
  never excerpts, generated summaries, keys, or raw API error responses.

The [official OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-4o-mini)
confirms the chosen model's API support. JSON mode and validation follow the
[official output-format guidance](https://developers.openai.com/api/docs/guides/structured-outputs).
This implementation uses JSON mode with strict local validation, not schema-constrained
generation; malformed output remains possible and is handled as a failure.
