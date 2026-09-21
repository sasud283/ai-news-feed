CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  error_type text,
  model text,
  model_calls integer NOT NULL DEFAULT 0 CHECK (model_calls >= 0),
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  estimated_cost_usd numeric(12, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  input_usd_per_million numeric(10, 4) NOT NULL,
  output_usd_per_million numeric(10, 4) NOT NULL,
  stories_created integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  deferred_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pipeline_runs FROM anon, authenticated;
GRANT ALL ON public.pipeline_runs TO service_role;
