ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS language TEXT;

UPDATE public.stories
SET language = 'English'
WHERE language IS NULL;

ALTER TABLE public.stories
ALTER COLUMN language SET DEFAULT 'English',
ALTER COLUMN language SET NOT NULL;
