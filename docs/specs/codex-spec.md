# AI News Aggregator — Codex Product Spec & System Prompt

> Hand this file to OpenAI Codex at the start of each coding session.
> It covers the full build scope, hard constraints, and a ready-to-paste system prompt.

---

## 1. Project Overview

**What we're building:** A self-hosted AI news aggregator that pulls from ~80 curated RSS feeds (plus a handful of scraped sources), runs lightweight summarisation with the OpenAI API, and publishes a static HTML site updated on a schedule.

**Key design decisions:**
- No database until v2 — SQLite for local dev, Postgres on prod
- No JavaScript framework — plain HTML + Jinja2 templates
- No scraping unless `robots.txt` permits it; RSS-first everywhere
- Cost discipline: OpenAI calls use `gpt-4o-mini`; summarise only new items
- **The entire project — backend, frontend, templates, and generated site output — lives in one GitHub repository. Codex writes all files within that repo folder and nowhere else.**

**Repository structure (Codex must follow this layout):**

```
repo/
├── src/
│   ├── ingestion/          # Feed polling & scraping
│   │   ├── rss_poller.py
│   │   ├── scraper.py
│   │   └── sources.json    # Source registry
│   ├── processing/         # Dedup, filter, summarise
│   │   ├── deduplicator.py
│   │   ├── summariser.py
│   │   └── classifier.py
│   ├── storage/            # DB layer
│   │   ├── models.py
│   │   └── db.py
│   └── site/               # Static site generator
│       ├── build.py        # Renders templates → public/
│       ├── templates/      # Jinja2 .html templates
│       └── static/         # CSS, icons, fonts
├── public/                 # GENERATED OUTPUT — committed to repo
│   ├── index.html
│   ├── topic/
│   └── assets/
├── tests/
├── .github/
│   └── workflows/
│       └── daily.yml       # GH Actions: poll → process → build → commit public/
├── requirements.txt
├── .env.example
└── README.md
```

**Critical repo rule:** `public/` is the generated static site. It is committed to the repository and served directly from GitHub Pages (or Vercel/Netlify pointing at the repo). Codex never writes frontend output to `/tmp`, external paths, or any location outside the repo.

---

## 2. Build Phases — What Codex Writes

| Phase | Module | Codex writes | Key libraries |
|---|---|---|---|
| **1 · Ingestion** | `src/ingestion/` | `rss_poller.py`, `scraper.py`, `sources.json` | `feedparser`, `httpx`, `playwright` |
| **2 · Processing** | `src/processing/` | `deduplicator.py`, `summariser.py`, `classifier.py` | `openai`, `tiktoken`, `difflib` |
| **3 · Storage** | `src/storage/` | `models.py`, `db.py`, migrations | `sqlite3` → `asyncpg` |
| **4 · Site** | `src/site/` + `public/` | `build.py`, Jinja2 templates, CSS, generated HTML | `jinja2`, `markdown` |
| **5 · Ops** | `.github/workflows/` | `daily.yml`, `Dockerfile` (optional) | GH Actions, `pytest`, `ruff` |

---

## 3. Constraints Codex Must Respect

1. **Python 3.11+** — use `asyncio`, `match` statements, type hints throughout.
2. **RSS-first** — always try RSS/Atom before writing a scraper. Scrape only if `robots.txt` permits and no feed exists.
3. **Cost discipline** — all OpenAI calls use `gpt-4o-mini`. Summarise only items not yet in DB. Keep prompts under 500 tokens.
4. **No heavy frameworks** — no Django, FastAPI, React, Vue, Next.js. `http.server` or a minimal WSGI for local preview only.
5. **EU copyright compliance** — store only title, URL, publication date, summary (AI-generated). Never store full article body text.
6. **Rate limiting** — honour `Crawl-delay` from `robots.txt`. Default 2-second delay between HTTP requests to the same domain.
7. **Secrets hygiene** — all keys via environment variables. Never hardcode. Always provide `.env.example` with placeholder values.
8. **Tests for every module** — minimum one `pytest` test per file. Tests go in `tests/` mirroring `src/` structure.
9. **Structured logging** — use Python `logging` with JSON formatter. No bare `print()` statements in production code.
10. **Repo-only file writes** — all file I/O (templates, generated HTML, assets, DB files, logs) writes within the repository folder. **Never write to `/tmp`, home directory, or external paths.** The `public/` directory (generated HTML output) is inside the repo and committed by the GH Actions workflow.
11. **`ruff` + `black`** — all code must pass `ruff check` and `black --check` before commit.
12. **Incremental builds** — `build.py` regenerates only changed pages where possible; full rebuild flag available.

---

## 4. Source Map Summary

**Feed types:**
- ~85% RSS/Atom (direct feedparser)
- ~10% JSON API (e.g. HackerNews, arXiv)
- ~5% HTML scrape (where robots.txt permits)

**Source categories and example feeds:**

| Category | Example sources | Count |
|---|---|---|
| Cross-Topic / Newsletters | The Batch, Import AI, The Gradient, AI Breakfast | ~10 |
| Models & Research | ArXiv cs.AI, DeepMind, Hugging Face, Anthropic, OpenAI, Google DeepMind | ~10 |
| Ethics & Safety | AI Now, Algorithmic Justice League, GovAI, CAIS, Redwood Research | ~8 |
| Policy & Regulation | Future of Life, Euractiv AI, Politico EU Tech, AlgorithmWatch | ~8 |
| Tools & Products | Product Hunt AI, a16z, Simon Willison, TLDR AI | ~8 |
| Business & VC | TechCrunch AI, VentureBeat AI, The Information AI, Axios AI | ~7 |
| Geopolitics | SCMP Tech, Nikkei Asia, Rest of World, Inc42 Tech, Analytics India Mag, Synced | ~8 |
| AI Equity | AI Now, AINow Gender, Algorithmic Justice League, Distributed AI Research, Data & Society | ~6 |
| Mainstream Press | BBC Tech, Guardian Tech, FT Tech, Reuters Tech, AP Tech | ~6 |
| AI for Good | ITU AI for Good, GovAI, Alan Turing Institute, AI4D Africa, UNDP Digital, Apolitical | ~6 |

Full source list with RSS URLs is in `src/ingestion/sources.json` (Codex generates this file in Phase 1).

---

## 5. Codex System Prompt

> Paste this verbatim into the Codex system prompt field before starting any session.

---

```
You are the coding assistant for a Python-based AI news aggregator project.

## Project context
- Self-hosted RSS aggregator covering ~80 AI/tech sources across 10 topic categories
- Python 3.11+, feedparser, httpx, playwright, OpenAI API (gpt-4o-mini), Jinja2, SQLite → Postgres, GitHub Actions
- Static HTML site generated by src/site/build.py and output to public/ within the repo
- Deployed via GitHub Pages or Vercel/Netlify pointing at the repo

## CRITICAL: File location rule
The entire project — backend, frontend templates, and ALL generated site output — lives inside the GitHub repository folder. You MUST write all files within the repo structure:
- Backend code → src/
- Jinja2 templates → src/site/templates/
- CSS and static assets → src/site/static/
- Generated HTML output → public/
Never write to /tmp, home directories, or any path outside the repository. The public/ directory is committed to the repo and served as the static site.

## Hard rules
1. RSS-first: always prefer feedparser over scraping; scrape only if robots.txt permits
2. OpenAI calls: gpt-4o-mini only; summarise new items only; prompts under 500 tokens
3. No frameworks: no Django/FastAPI/React/Vue/Next.js — plain Python and Jinja2
4. EU copyright: store title, URL, date, AI-generated summary only — never full article body
5. Rate limiting: 2-second default delay between requests to the same domain
6. Secrets: all API keys via environment variables; provide .env.example
7. Tests: pytest test for every module in tests/ directory
8. Logging: structured JSON logging; no bare print() in production code
9. Code quality: all code passes ruff check and black --check
10. Incremental builds: build.py regenerates only changed pages; --full flag for full rebuild

## Repo layout (do not deviate)
src/ingestion/   ← rss_poller.py, scraper.py, sources.json
src/processing/  ← deduplicator.py, summariser.py, classifier.py
src/storage/     ← models.py, db.py
src/site/        ← build.py, templates/, static/
public/          ← GENERATED OUTPUT (committed to repo, served as site)
tests/           ← mirrors src/ structure
.github/workflows/daily.yml ← GH Actions pipeline

## Style
- Type hints on all functions
- Docstrings for public functions (Google style)
- async/await for all I/O
- match statements where appropriate (Python 3.10+ style)
- Prefer dataclasses or Pydantic models for structured data
```

---

## 6. Recommended First Codex Session Prompt

Paste this after the system prompt to kick off Phase 1:

```
Start Phase 1: RSS ingestion.

Create the following files within the repo:

1. src/ingestion/sources.json
   - JSON array of source objects: {name, url, feed_url, category, region, connection_type, notes}
   - Include all 10 categories from the spec
   - Start with 10 high-confidence RSS sources (one per category) as a scaffold; I'll add the rest

2. src/ingestion/rss_poller.py
   - Async function: poll_all_sources(sources: list[Source]) -> list[FeedItem]
   - Uses feedparser; falls back to httpx for feeds feedparser can't parse
   - Respects 2-second rate limit per domain
   - Returns dataclass FeedItem: {title, url, published_at, source_name, category, raw_summary}
   - Structured JSON logging on success and error per feed

3. tests/test_rss_poller.py
   - At minimum: test_poll_single_source_returns_items, test_rate_limit_respected, test_bad_url_handled_gracefully
   - Use pytest-asyncio; mock HTTP calls with respx

Write all files to the repo folder. Do not use /tmp or external paths.
After writing, show me the file tree and run: ruff check src/ingestion/ && python -m pytest tests/test_rss_poller.py -v
```

---

*Last updated: 2026-09-18 | Doc: AI News Aggregator Product & Functionality Spec*
