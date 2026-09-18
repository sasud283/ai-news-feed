ALTER TABLE public.stories
  ADD COLUMN content_type TEXT NOT NULL DEFAULT 'Article',
  ADD COLUMN media_url TEXT;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_content_type_check
  CHECK (content_type IN ('Article', 'Podcast', 'Video'));

COMMENT ON COLUMN public.stories.content_type IS 'Editorial format shown on story cards: Article, Podcast, or Video.';
COMMENT ON COLUMN public.stories.media_url IS 'Optional direct audio URL or supported video page/embed URL.';