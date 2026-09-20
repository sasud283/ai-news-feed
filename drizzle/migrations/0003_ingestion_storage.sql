-- Apply once, after 0002. Existing pending reviews become private.
ALTER TYPE public.spot_check_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TABLE public.stories
  ADD COLUMN canonical_url text UNIQUE,
  ADD COLUMN publication_status text NOT NULL DEFAULT 'review'
    CHECK (publication_status IN ('review', 'published', 'rejected')),
  ADD COLUMN processing_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN related_to_url text,
  ALTER COLUMN published_at DROP NOT NULL,
  ALTER COLUMN published_at DROP DEFAULT;
UPDATE public.stories s SET publication_status = 'published'
WHERE NOT EXISTS (SELECT 1 FROM public.spot_check_queue q
                  WHERE q.story_id = s.id AND q.status = 'pending');
ALTER TABLE public.story_tags
  ALTER COLUMN tone DROP NOT NULL, ALTER COLUMN access DROP NOT NULL,
  ALTER COLUMN geography DROP NOT NULL;
ALTER TABLE public.story_sources
  ALTER COLUMN is_paywalled DROP NOT NULL, ALTER COLUMN is_paywalled DROP DEFAULT;
CREATE INDEX stories_ingestion_date ON public.stories(published_at);
CREATE INDEX story_sources_lookup ON public.story_sources(story_id, source_url);

-- No publisher excerpts: fresh feed evidence is preferred; missing entries retry from titles.
CREATE TABLE public.ingestion_urls (
  url text PRIMARY KEY,
  story_id uuid REFERENCES public.stories(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('stored', 'rejected', 'failed', 'deferred')),
  error_type text,
  headline text,
  published_at timestamptz,
  source_name text,
  category text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'stored') = (story_id IS NOT NULL))
);
ALTER TABLE public.ingestion_urls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_urls FROM anon, authenticated;
GRANT ALL ON public.ingestion_urls TO service_role;

DROP POLICY "stories public read" ON public.stories;
CREATE POLICY "stories public read" ON public.stories FOR SELECT TO anon, authenticated
  USING (publication_status = 'published');
DROP POLICY "topics public read" ON public.story_topics;
CREATE POLICY "topics public read" ON public.story_topics FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.publication_status = 'published'));
DROP POLICY "tags public read" ON public.story_tags;
CREATE POLICY "tags public read" ON public.story_tags FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.publication_status = 'published'));
DROP POLICY "sources public read" ON public.story_sources;
CREATE POLICY "sources public read" ON public.story_sources FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.publication_status = 'published'));

-- One transaction validates queue ownership, edits and publishes. User JWT required.
CREATE FUNCTION public.review_story(p_queue_id uuid, p_action text, p_correction jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_story_id uuid;
  v_story public.stories;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  -- Same lock order as ingestion: story, then queue. Recheck queue after locking.
  SELECT story_id INTO v_story_id FROM public.spot_check_queue WHERE id = p_queue_id;
  IF v_story_id IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
  PERFORM 1 FROM public.stories WHERE id = v_story_id FOR UPDATE;
  PERFORM 1 FROM public.spot_check_queue WHERE id = p_queue_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review is no longer pending'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve', 'correct', 'reject') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  IF p_action = 'correct' THEN
    IF p_correction IS NULL OR jsonb_typeof(p_correction->'topics') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Correction fields required';
    END IF;
    UPDATE public.stories SET ai_generated_summary = p_correction->>'summary',
      published_at = (p_correction->>'published_at')::timestamptz WHERE id = v_story_id;
    INSERT INTO public.story_tags(story_id, tone, access, geography)
      VALUES (v_story_id, (p_correction->>'tone')::public.story_tone,
        (p_correction->>'access')::public.story_access,
        (p_correction->>'geography')::public.story_geography)
      ON CONFLICT (story_id) DO UPDATE SET tone = EXCLUDED.tone,
        access = EXCLUDED.access, geography = EXCLUDED.geography;
    DELETE FROM public.story_topics WHERE story_id = v_story_id;
    INSERT INTO public.story_topics(story_id, topic)
      SELECT DISTINCT v_story_id, value::public.story_topic
      FROM jsonb_array_elements_text(p_correction->'topics');
  END IF;
  IF p_action <> 'reject' THEN
    SELECT * INTO v_story FROM public.stories WHERE id = v_story_id;
    IF nullif(trim(v_story.ai_generated_summary), '') IS NULL OR v_story.published_at IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.story_topics WHERE story_id = v_story_id)
       OR NOT EXISTS (SELECT 1 FROM public.story_sources WHERE story_id = v_story_id)
       OR NOT EXISTS (SELECT 1 FROM public.story_tags WHERE story_id = v_story_id
                      AND tone IS NOT NULL AND access IS NOT NULL AND geography IS NOT NULL) THEN
      RAISE EXCEPTION 'Complete the summary, date, topics and tags before publishing';
    END IF;
  END IF;
  UPDATE public.stories SET publication_status = CASE WHEN p_action = 'reject' THEN 'rejected' ELSE 'published' END,
    updated_at = now() WHERE id = v_story_id;
  UPDATE public.spot_check_queue SET status = CASE WHEN p_action = 'correct' THEN 'corrected'::public.spot_check_status
    WHEN p_action = 'reject' THEN 'rejected'::public.spot_check_status
    ELSE 'approved'::public.spot_check_status END, reviewed_at = now()
    WHERE story_id = v_story_id AND status = 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.review_story(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_story(uuid, text, jsonb) TO authenticated;
