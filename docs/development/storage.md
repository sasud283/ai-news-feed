# Phase 3: persistent storage and editorial publication

The worker now writes to the existing Supabase Postgres schema using asyncpg.
The React/TanStack website remains in place. This supersedes the original spec's
SQLite-first/static-site path for this phase, as agreed for the existing project.

## Activation order

Live database initialization completed on 2026-09-20 for project
`heafyqorilcomdmfmqll`. Migrations 0000–0004 were applied in one transaction;
the demonstration seed rows in 0000 were intentionally omitted. The standard
Drizzle migration journal records the applied versions. The live database starts
empty, and anonymous access to private story/source records was tested with
transactional probes that were rolled back.

Local connection settings are in ignored `.env.local`. Public project settings
have been switched locally; the hosted website has not been redeployed. Remaining
activation work: create/confirm the editor account and explicitly grant its admin
role, configure OPENAI_API_KEY privately, run a small real batch, and update the
hosting environment before deploying. Database credentials must never be committed.

For another existing installation, the activation sequence is:

1. Apply `drizzle/migrations/0003_ingestion_storage.sql` and
   `0004_explicit_admin_assignment.sql` **once**, after migrations
   0000–0002, using the project's migration service or Supabase SQL editor.
   Use a transaction for the whole file. It adds storage fields, preserves existing
   stories, and makes stories with pending reviews private. Existing unflagged
   stories remain published. No source registry changes are included.
2. Deploy the accompanying frontend changes after the migration. The new feed
   explicitly filters published stories, including for signed-in administrators.
   Deploying the frontend first will fail against the old schema.
3. Configure the worker's `DATABASE_URL` with the Supabase connection string and
   TLS (`sslmode=require`), plus `OPENAI_API_KEY`. Use a backend connection with
   permission to write these tables. `statement_cache_size=0` supports a pooled
   connection. Do not use a browser publishable key as a database password.
4. Ensure the website server has `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY`. Sign in through `/auth` with an existing admin
   account to use `/review`. New signups are ordinary users, including the first
   signup; a trusted database operator must grant the intended confirmed account
   its admin role. The review functions no longer use a service-role
   client; both the server and the database check the authenticated admin role.
5. Run one small batch from the repository root:

   ```sh
   .venv/bin/python -m src.storage.run --max-new-stories 5
   ```

The worker reads environment variables; it does not automatically load `.env`.
Do not put private credentials into the repository's existing tracked `.env`.
A zero request budget records/defer new items without spending on model calls;
it can still attach sources to existing stories and require a new review.
Scheduling and worker hosting remain later operations work.

## Data and publication behavior

- `ingestion_urls` tracks canonical URLs and stored/rejected/failed/deferred states.
  Stored and rejected URLs are skipped on later batches. Retry states are private
  to the backend and contain only headline, date, source identity, category and
  safe failure type. Publisher excerpts never enter a database query.
- Up to 500 older retry records are loaded per batch, with fresh feed evidence
  preferred when present. Items no longer in a feed retry using title-only
  evidence, which Phase 2 flags for review. Failures rotate by last attempt time;
  there is no automatic timer, backoff scheduler, or permanently-failed state yet.
- Nearby stored titles/dates are passed back to the conservative Phase 2 grouper.
  New source links attach without another model call. The affected story returns
  to private review, and aggregate access is recalculated from known source access.
- Complete, unflagged stories publish; flagged/incomplete stories stay in review.
  The manual runner has no verified access map, so new stories normally need an
  editor to confirm access. Callers can pass verified `access_by_url` to
  `process_and_store` when that metadata is available.
- Missing dates, tone, access, geography and per-source paywall values stay null.
  The reviewer must explicitly fill missing publication fields. Approval means
  the editor verified the story's aggregate access; unknown per-source access
  remains unknown. Possible follow-ups are shown for comparison, not automatically
  marked as confirmed corrections.
- Review corrections, queue completion and publication happen in one database
  transaction. Rejecting keeps the story private and its URLs marked seen.
  Public row policies also hide a private story's topics, tags and source links.
- The transaction-level worker lock excludes overlapping processing runs before
  model requests. A busy runner exits with code 2; failures exit 1. Success exits 0.
  Database writes roll back together; replays do not overwrite editorial changes.
  A crash after a model response but before commit can still incur repeat model
  cost on retry. This is not an exactly-once billing guarantee. Keep batches small.
- Legacy stories have no canonical URL; exact matching source URLs are recognized
  as seen, but legacy records are not guessed into cross-publisher headline groups.

## Files and verification

- `src/storage/models.py`: typed metadata history and busy-worker error.
- `src/storage/db.py`: history, backlog, atomic persistence and processing wrapper.
- `src/storage/run.py`: bounded manual poll/process/store runner.
- `drizzle/migrations/0003_ingestion_storage.sql`: schema, row policies, review RPC.
- `src/lib/storage.types.ts`: local type extension; generated integration files are
  preserved. Refresh generated types through Lovable after the migration.
- `tests/storage/`: Python tests exercising real PostgreSQL semantics through an
  isolated, in-memory PGlite engine. No live Supabase writes or model calls.

Install both Python and frontend dev dependencies before running the full suite:

```sh
.venv/bin/python -m pip install --cache-dir .cache/pip -r requirements-dev.txt
npm install --package-lock=false --cache .cache/npm
.venv/bin/ruff check src/ingestion src/processing src/storage
.venv/bin/black --check src/ingestion src/processing src/storage tests
.venv/bin/python -m pytest -v
node_modules/.bin/tsc --noEmit
npm run build
```

Tests cover URL reuse, source updates without model calls, unknown metadata,
failed/deferred retries, rollback, publication/rejection, anonymous reads and
non-admin denial. PGlite verifies SQL and row policies; the live connection,
Supabase gateway and hosted sign-in flow still need an activation smoke test.
The worker schema is managed by the migration, not by regenerating the empty
`drizzle/schema.ts` stub. Do not regenerate migrations from that stub.
