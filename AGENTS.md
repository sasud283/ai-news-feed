<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Folder organization

- Keep the repository root for README.md, AGENTS.md, dependency manifests,
  lockfiles, and configuration files required by the tools.
- Put product specifications and reference documents in docs/specs/;
  development guides in docs/development/; planning in docs/roadmap.md.
- The Python ingestion source of truth is docs/specs/codex-spec.md.
  The original frontend brief is docs/specs/frontend-spec.md. Preserve the
  existing frontend and its tool paths when working on Python ingestion.
- Keep Python ingestion in src/ingestion/ and tests in tests/ as requested.
  Follow existing frontend folders for routes, components, hooks, and assets.
- Keep database schema and migrations in drizzle/ and service config in supabase/.
- Use .cache/ for tool caches, .tmp/ for temporary work, and .venv/ for Python.
  Keep all generated working files inside this repository and out of Git.
- When moving files, update links and configuration and check affected workflows.
  Do not create loose reports, duplicate specs, or backup copies at the root.

## Source registry maintenance

- The expanded source list in docs/specs/source-list.txt supersedes the original
  ten-source scaffold requirement. See docs/sources/README.md for current status.
- Keep only verified RSS/Atom connections in src/ingestion/sources.json. Preserve
  unresolved, manual, email, scrape, or excluded entries in sources-pending.json.
- Deduplicate repeated feeds while preserving all supplied topic coverage.
  Keep cross-topic article sources first, then supplemental sources and podcasts.
- Keep the seven-field Source schema compatible. Record verification results,
  original URLs, source aliases, and topic mappings in docs/sources/verification.json.
- Treat popularity and scraping-permission claims in supplied lists as unverified.
  Validate current feed access and robots rules before activating a connection.

## Processing conventions

- Phase 2 uses gpt-4o-mini, explicitly confirmed by the user. Keep prompts below
  500 tokens and combine classification and summary in one request per new group.
- Keep processing modules in src/processing/ and their tests in tests/processing/.
- Follow the frontend's current topic/tone/geography enums. Keep podcast/video
  source identities current in src/processing/source_types.json when editing sources.
- Do not persist publisher excerpts. Preserve review flags and unknown access;
  never convert missing metadata to confident labels just to fit the database.
- Pass persisted seen URLs and recent metadata to processing when storage is added.
  Keep deferred and failed items retryable. See docs/development/processing.md.
