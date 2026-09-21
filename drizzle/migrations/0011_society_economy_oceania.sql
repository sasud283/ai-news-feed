-- Broader social and macroeconomic coverage plus Australia/Pacific geography.
ALTER TYPE public.story_topic ADD VALUE IF NOT EXISTS 'Society & Economy';
ALTER TYPE public.story_geography ADD VALUE IF NOT EXISTS 'Oceania';
