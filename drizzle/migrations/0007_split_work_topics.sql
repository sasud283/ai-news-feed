-- Replace the enum rather than retaining a selectable legacy category.
-- Old work stories get provisional topic suggestions and return to review.
CREATE TEMP TABLE work_topic_migration ON COMMIT DROP AS
 SELECT s.id,
 CASE
  WHEN lower(s.headline || ' ' || s.ai_generated_summary) ~ '(boardroom|board member|chief executive|c-suite|competitive position|corporate strateg)' THEN 'Leadership'
  WHEN lower(s.headline || ' ' || s.ai_generated_summary) ~ '(labour market|labor market|displac|job loss|unemploy|layoff|trade union)' THEN 'People & Jobs'
  ELSE 'Organisations'
 END AS replacement
 FROM public.stories s JOIN public.story_topics t ON t.story_id=s.id
 WHERE t.topic::text='Future of Work';

ALTER TYPE public.story_topic RENAME TO story_topic_legacy;
CREATE TYPE public.story_topic AS ENUM (
 'Models & Research','Business & Funding','Policy & Regulation','National Initiatives',
 'Ethics','Leadership','Organisations','People & Jobs','Future of Daily Life',
 'AI Equity & Representation','Tools & Products'
);
-- Convert via text first so provisional suggestions can use the new labels.
ALTER TABLE public.story_topics ALTER COLUMN topic TYPE text USING topic::text;
UPDATE public.story_topics t SET topic=m.replacement
 FROM work_topic_migration m WHERE t.story_id=m.id AND t.topic='Future of Work';
ALTER TABLE public.story_topics ALTER COLUMN topic TYPE public.story_topic USING topic::public.story_topic;
DROP TYPE public.story_topic_legacy;

UPDATE public.stories s SET publication_status='review',
 processing_metadata=coalesce(processing_metadata,'{}'::jsonb) || jsonb_build_object(
 'topic_migration',jsonb_build_object('version','work-split-v1','previous_topic','Future of Work',
 'suggested_topic',m.replacement,'requires_review',true))
 FROM work_topic_migration m WHERE s.id=m.id AND s.publication_status <> 'rejected';
INSERT INTO public.spot_check_queue(story_id,reason)
 SELECT m.id,'work_topic_split_requires_review' FROM work_topic_migration m
 JOIN public.stories s ON s.id=m.id
 WHERE s.publication_status <> 'rejected'
 AND NOT EXISTS(SELECT 1 FROM public.spot_check_queue q WHERE q.story_id=m.id AND q.status='pending');

-- Broad legacy preferences become all three categories, without widening other selections.
CREATE FUNCTION pg_temp.expand_work_topics(input text[]) RETURNS text[] LANGUAGE sql AS $$
 SELECT coalesce(array_agg(value ORDER BY first_position,subposition),'{}'::text[])
 FROM (
  SELECT DISTINCT ON (replacement.value) replacement.value,position AS first_position,subposition
  FROM unnest(input) WITH ORDINALITY AS old(value,position)
  CROSS JOIN LATERAL unnest(CASE WHEN old.value='Future of Work'
   THEN ARRAY['Leadership','Organisations','People & Jobs'] ELSE ARRAY[old.value] END)
   WITH ORDINALITY AS replacement(value,subposition)
  ORDER BY replacement.value,position,subposition
 ) expanded
$$;
UPDATE public.newsletter_members SET topics=pg_temp.expand_work_topics(topics)
 WHERE 'Future of Work'=ANY(topics);
UPDATE public.newsletter_checkouts SET topics=pg_temp.expand_work_topics(topics)
 WHERE 'Future of Work'=ANY(topics);
UPDATE public.digest_subscribers SET filter_preferences=jsonb_set(filter_preferences,'{topics}',
 to_jsonb(pg_temp.expand_work_topics(ARRAY(SELECT jsonb_array_elements_text(filter_preferences->'topics')))))
 WHERE jsonb_typeof(filter_preferences->'topics')='array' AND filter_preferences->'topics' ? 'Future of Work';
UPDATE public.profiles SET default_filters=jsonb_set(default_filters,'{topics}',
 to_jsonb(pg_temp.expand_work_topics(ARRAY(SELECT jsonb_array_elements_text(default_filters->'topics')))))
 WHERE jsonb_typeof(default_filters->'topics')='array' AND default_filters->'topics' ? 'Future of Work';

UPDATE public.ingestion_urls SET category=CASE
 WHEN source_name IN ('Fortune (Future of Work)') THEN 'Leadership'
 WHEN source_name IN ('WEF Future of Jobs','McKinsey Global Institute','Work of the Future (MIT)','LinkedIn Work Change Report') THEN 'People & Jobs'
 ELSE 'Organisations' END
 WHERE category IN ('Future of Work','Future of Work & Daily Life');
