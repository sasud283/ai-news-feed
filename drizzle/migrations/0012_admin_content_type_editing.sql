-- Let authenticated administrators correct content type with the other story fields.
CREATE FUNCTION public.apply_story_correction(p_story_id uuid, p_correction jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_content_type text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  v_content_type := p_correction->>'content_type';
  IF p_correction IS NULL
     OR nullif(trim(p_correction->>'summary'), '') IS NULL
     OR v_content_type NOT IN ('Article', 'Podcast', 'Video')
     OR jsonb_typeof(p_correction->'topics') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_correction->'topics') = 0
     OR jsonb_typeof(p_correction->'geographies') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_correction->'geographies') NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'Complete correction fields required';
  END IF;
  UPDATE public.stories SET
    ai_generated_summary = p_correction->>'summary',
    published_at = (p_correction->>'published_at')::timestamptz,
    media_url = CASE
      WHEN v_content_type = 'Article' THEN NULL
      WHEN content_type = v_content_type AND media_url IS NOT NULL THEN media_url
      ELSE (SELECT source_url FROM public.story_sources
            WHERE story_id = p_story_id ORDER BY id LIMIT 1)
    END,
    content_type = v_content_type,
    processing_metadata = coalesce(processing_metadata, '{}'::jsonb) ||
      jsonb_build_object('last_editorial_edit', jsonb_build_object(
        'edited_at', now(), 'editor_id', auth.uid())),
    updated_at = now()
    WHERE id = p_story_id;
  INSERT INTO public.story_tags(story_id, tone, access, geography, secondary_geography)
    VALUES (p_story_id, (p_correction->>'tone')::public.story_tone,
      (p_correction->>'access')::public.story_access,
      (p_correction->'geographies'->>0)::public.story_geography,
      CASE WHEN jsonb_array_length(p_correction->'geographies') = 2
        THEN (p_correction->'geographies'->>1)::public.story_geography END)
    ON CONFLICT (story_id) DO UPDATE SET tone = EXCLUDED.tone,
      access = EXCLUDED.access, geography = EXCLUDED.geography,
      secondary_geography = EXCLUDED.secondary_geography;
  DELETE FROM public.story_topics WHERE story_id = p_story_id;
  INSERT INTO public.story_topics(story_id, topic)
    SELECT DISTINCT p_story_id, value::public.story_topic
    FROM jsonb_array_elements_text(p_correction->'topics');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_story_correction(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_story_correction(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_story(
  p_queue_id uuid, p_action text, p_correction jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_story_id uuid;
  v_story public.stories;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  SELECT story_id INTO v_story_id FROM public.spot_check_queue WHERE id = p_queue_id;
  IF v_story_id IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
  PERFORM 1 FROM public.stories WHERE id = v_story_id FOR UPDATE;
  PERFORM 1 FROM public.spot_check_queue WHERE id = p_queue_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review is no longer pending'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve', 'correct', 'reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;
  IF p_action = 'correct' THEN
    PERFORM public.apply_story_correction(v_story_id, p_correction);
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

CREATE OR REPLACE FUNCTION public.update_published_story(p_story_id uuid, p_correction jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.stories
    WHERE id = p_story_id AND publication_status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Published story not found'; END IF;
  PERFORM public.apply_story_correction(p_story_id, p_correction);
END;
$$;
