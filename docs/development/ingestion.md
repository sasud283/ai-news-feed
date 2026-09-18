# The Full Picture AI — Phase 1

Run the commands below from the repository root. Requires Python 3.11+. All setup, caches, and output remain in this repository:

```sh
python3 -m venv .venv
source .venv/bin/activate
mkdir -p .cache/pip .cache/black .tmp
TMPDIR="$PWD/.tmp" python -m pip install --cache-dir .cache/pip -r requirements-dev.txt
ruff check src/ingestion/ && python -m pytest tests/test_rss_poller.py -v
BLACK_CACHE_DIR="$PWD/.cache/black" black --check src/ingestion tests
```

`src/ingestion/sources.json` contains verified RSS/Atom feeds from the expanded
[source inventory](../sources/README.md). Each object still uses the seven-field
Source schema. Convert each object to `Source(**entry)` and await
`poll_all_sources(sources)`. Cross-topic article feeds appear first in the registry;
the poller currently starts feeds concurrently, so this is editorial ordering,
not a guarantee that those feeds complete before supplemental feeds.

`src/ingestion/sources-pending.json` preserves sources with failed verification,
missing feed URLs, manual ingestion, or explicit exclusion from the MVP. Do not
pass that file to the poller. Review and revalidate an entry before moving it to
the polling registry. An empty feed_url means no confirmed feed is available.

Call polling batches sequentially: domain pacing is shared across feeds within
a batch, not across separate calls/processes. Run the full ingestion tests with
`python -m pytest tests/ -v` (this includes registry validation).

HTTPX performs async network I/O. Feedparser first parses response bytes off the
event loop. If those cannot be parsed, a rate-limited HTTPX retry requests XML
and passes HTTP-decoded text to feedparser. HTTPX itself does not parse feeds.
Unparseable responses and HTTP failures log a JSON error and return no items;
other sources continue. Feed redirects are explicitly rate-limited.

Requests, including robots lookups and retries, start at least two seconds apart
per hostname. A longer robots.txt Crawl-delay takes precedence. Disallowed feeds
are skipped. Missing robots policies (404/410) use defaults; other robots errors,
including redirects, skip that feed conservatively. Requests time out after 20
seconds. JSON outcome logs go to stderr without writing log files.

FeedItem.raw_summary is transient publisher metadata, never stored by this module.
Article content fields are excluded. Future storage must use an AI-generated
summary instead. Publication dates are UTC datetime values or None.

The feed checks are a point-in-time snapshot recorded in
[verification.json](../sources/verification.json). They check HTTP access,
robots policy, and RSS/Atom parsing; they do not guarantee future availability,
editorial quality, or successful classification. Broad feeds still need AI
filtering in Phase 2. Category is a primary source-level label; additional topic
coverage is retained in notes and the verification inventory.

Podcasts use episode links and descriptions only. There is no audio/video
downloading or transcription, scraper, scheduler, or Supabase publishing in this
module. The YouTube candidates remain pending because the current robots-aware
poller does not permit their feed paths. Data & Society was removed because it
was not in the replacement source list.
