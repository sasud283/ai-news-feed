# The Full Picture AI

AI news frontend built with Lovable, React, TanStack Start, and Supabase, with
Python RSS ingestion in the same repository.

Repository: [sasud283/ai-news-feed](https://github.com/sasud283/ai-news-feed).

## Where things live

| Folder | Contents |
| --- | --- |
| `docs/specs/` | Product PDF, Python ingestion spec, original frontend brief |
| `docs/development/` | Setup and implementation guides |
| `docs/sources/` | Source inventory, verification results, and pending connections |
| `docs/roadmap.md` | Frontend progress and planning |
| `src/ingestion/` | Python RSS poller and source registry |
| `src/processing/` | Deduplication, classification, summaries, and review flags |
| `src/storage/` | Persistent processing state and Supabase publication |
| `src/routes/`, `src/components/`, `src/hooks/` | Frontend pages and UI |
| `src/lib/`, `src/integrations/` | Frontend helpers and service connections |
| `src/assets/`, `public/` | Bundled images and publicly served assets |
| `tests/` | Python ingestion, processing and storage tests |
| `drizzle/` | Database schema and migrations |
| `supabase/` | Supabase configuration |
| `.lovable/` | Lovable project metadata and plans |
| `.cache/`, `.tmp/`, `.venv/` | Ignored local caches, temporary files, Python environment |

Root configuration and dependency files stay where the existing tools expect them.

## Documentation

- [Python ingestion specification](docs/specs/codex-spec.md)
- [Product and functionality specification (PDF)](docs/specs/product-functionality-spec.pdf)
- [Original frontend brief](docs/specs/frontend-spec.md)
- [Ingestion setup and behavior](docs/development/ingestion.md)
- [Processing setup and behavior](docs/development/processing.md)
- [Editorial label definitions](docs/development/editorial-labels.md)
- [Storage setup and activation](docs/development/storage.md)
- [Source inventory and connection status](docs/sources/README.md)
- [Roadmap](docs/roadmap.md)

The Python spec describes a broader future architecture. The current frontend
uses React and Supabase. Phases 1–3 provide polling, processing, persistence and
review/publication controls. Phase 3 live activation requires applying the migration
and configuring the private database connection; see the storage guide.

## Local development

Run all commands from the repository root.

Frontend (Node.js and npm required):

```sh
npm install
npm run dev
```

Python ingestion, after following the [setup guide](docs/development/ingestion.md):

```sh
source .venv/bin/activate
ruff check src/ingestion/ src/processing/ src/storage/ && python -m pytest tests/ -v
```

## Lovable

Open the [Lovable editor](https://lovable.dev/projects/e1b3b901-41df-4890-b668-f4fb38cc205e)
to continue frontend work. Changes pushed to the connected branch sync to Lovable.
Preserve published Git history; see [project instructions](AGENTS.md).
