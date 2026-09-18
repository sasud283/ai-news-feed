-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.story_topic AS ENUM (
  'Models & Research','Business & Funding','Policy & Regulation','National Initiatives',
  'Ethics','Future of Work','Future of Daily Life','AI Equity & Representation','Tools & Products'
);
CREATE TYPE public.story_tone AS ENUM ('Good','Useful','Bad','Ugly');
CREATE TYPE public.story_access AS ENUM ('Free','Paid');
CREATE TYPE public.story_geography AS ENUM ('Worldwide','US','China','Europe','Africa','Latin America','South & Southeast Asia','Middle East');
CREATE TYPE public.spot_check_status AS ENUM ('pending','approved','corrected');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  default_filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- STORIES
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  ai_generated_summary TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_correction_of UUID REFERENCES public.stories(id) ON DELETE SET NULL
);
GRANT SELECT ON public.stories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories public read" ON public.stories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "stories admin write" ON public.stories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.story_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  topic public.story_topic NOT NULL,
  UNIQUE (story_id, topic)
);
GRANT SELECT ON public.story_topics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_topics TO authenticated;
GRANT ALL ON public.story_topics TO service_role;
ALTER TABLE public.story_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics public read" ON public.story_topics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "topics admin write" ON public.story_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.story_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL UNIQUE REFERENCES public.stories(id) ON DELETE CASCADE,
  tone public.story_tone NOT NULL,
  access public.story_access NOT NULL,
  geography public.story_geography NOT NULL
);
GRANT SELECT ON public.story_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_tags TO authenticated;
GRANT ALL ON public.story_tags TO service_role;
ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags public read" ON public.story_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tags admin write" ON public.story_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.story_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  is_paywalled BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT ON public.story_sources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_sources TO authenticated;
GRANT ALL ON public.story_sources TO service_role;
ALTER TABLE public.story_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources public read" ON public.story_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sources admin write" ON public.story_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.spot_check_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.spot_check_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spot_check_queue TO authenticated;
GRANT ALL ON public.spot_check_queue TO service_role;
ALTER TABLE public.spot_check_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue admin all" ON public.spot_check_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.digest_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filter_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  unsubscribed BOOLEAN NOT NULL DEFAULT false
);
GRANT INSERT ON public.digest_subscribers TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.digest_subscribers TO authenticated;
GRANT ALL ON public.digest_subscribers TO service_role;
ALTER TABLE public.digest_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can subscribe" ON public.digest_subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read subscribers" ON public.digest_subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- SEED DATA
INSERT INTO public.stories (id, headline, ai_generated_summary, published_at, updated_at) VALUES
('11111111-1111-4111-8111-000000000001','Open-weight model matches frontier benchmarks at a fraction of the cost','A newly released open-weight model reports parity with leading closed systems on reasoning and coding benchmarks while running on far cheaper hardware. Independent evaluators have reproduced part of the results, though long-context claims remain unverified.','2026-09-17 09:15:00+00','2026-09-17 09:15:00+00'),
('11111111-1111-4111-8111-000000000002','EU regulators publish first enforcement guidance for general-purpose AI','The guidance clarifies documentation and transparency duties for providers of general-purpose models, setting staged deadlines through next year. Smaller providers receive lighter obligations, but fines for systemic-risk models remain high.','2026-09-16 14:40:00+00','2026-09-16 14:40:00+00'),
('11111111-1111-4111-8111-000000000003','AI infrastructure startup raises $1.2B at a $14B valuation','The round is led by sovereign wealth and growth investors and will fund new data centre capacity. Analysts note the raise continues a concentration of compute funding in a handful of firms.','2026-09-16 08:05:00+00','2026-09-16 08:05:00+00'),
('11111111-1111-4111-8111-000000000004','Study finds uneven accuracy of speech recognition across African languages','Researchers benchmarked major speech systems on twelve African languages and found error rates up to four times higher than for English. The authors release an open evaluation set to support future work.','2026-09-15 17:20:00+00','2026-09-15 17:20:00+00'),
('11111111-1111-4111-8111-000000000005','Hospital chain pauses AI triage tool after audit finds biased referrals','An internal audit found that the tool under-referred patients from lower-income postcodes. The vendor disputes the methodology; the rollout is on hold pending external review.','2026-09-15 11:00:00+00','2026-09-15 11:00:00+00'),
('11111111-1111-4111-8111-000000000006','National AI compute programme opens applications to universities','The programme allocates subsidised GPU hours to accredited research groups, with a quota reserved for smaller institutions. Applications close at the end of the quarter.','2026-09-14 10:30:00+00','2026-09-14 10:30:00+00'),
('11111111-1111-4111-8111-000000000007','Survey: a third of customer support roles now include AI oversight duties','A cross-industry survey reports rapid growth in hybrid roles where staff review and correct model output. Pay changes are inconsistent and training is often informal.','2026-09-13 16:10:00+00','2026-09-13 16:10:00+00'),
('11111111-1111-4111-8111-000000000008','Consumer assistants add on-device scheduling and offline summaries','Two major assistants now run scheduling and summarisation locally, reducing latency and cloud data transfer. Feature availability varies by device generation.','2026-09-12 12:00:00+00','2026-09-12 12:00:00+00');

INSERT INTO public.stories (id, headline, ai_generated_summary, published_at, updated_at, is_correction_of) VALUES
('11111111-1111-4111-8111-000000000009','Correction: benchmark parity claim applies only to a subset of tasks','Follow-up reporting shows the open-weight model matches frontier systems on coding and maths subsets, not across the full benchmark suite. The original summary overstated the scope of the result.','2026-09-18 08:00:00+00','2026-09-18 08:00:00+00','11111111-1111-4111-8111-000000000001');

INSERT INTO public.story_topics (story_id, topic) VALUES
('11111111-1111-4111-8111-000000000001','Models & Research'),
('11111111-1111-4111-8111-000000000001','Tools & Products'),
('11111111-1111-4111-8111-000000000002','Policy & Regulation'),
('11111111-1111-4111-8111-000000000003','Business & Funding'),
('11111111-1111-4111-8111-000000000004','AI Equity & Representation'),
('11111111-1111-4111-8111-000000000004','Models & Research'),
('11111111-1111-4111-8111-000000000005','Ethics'),
('11111111-1111-4111-8111-000000000005','Future of Daily Life'),
('11111111-1111-4111-8111-000000000006','National Initiatives'),
('11111111-1111-4111-8111-000000000007','Future of Work'),
('11111111-1111-4111-8111-000000000008','Tools & Products'),
('11111111-1111-4111-8111-000000000008','Future of Daily Life'),
('11111111-1111-4111-8111-000000000009','Models & Research');

INSERT INTO public.story_tags (story_id, tone, access, geography) VALUES
('11111111-1111-4111-8111-000000000001','Good','Free','Worldwide'),
('11111111-1111-4111-8111-000000000002','Useful','Free','Europe'),
('11111111-1111-4111-8111-000000000003','Useful','Paid','US'),
('11111111-1111-4111-8111-000000000004','Bad','Free','Africa'),
('11111111-1111-4111-8111-000000000005','Ugly','Paid','US'),
('11111111-1111-4111-8111-000000000006','Good','Free','South & Southeast Asia'),
('11111111-1111-4111-8111-000000000007','Useful','Paid','Worldwide'),
('11111111-1111-4111-8111-000000000008','Good','Free','Worldwide'),
('11111111-1111-4111-8111-000000000009','Useful','Free','Worldwide');

INSERT INTO public.story_sources (story_id, source_name, source_url, is_paywalled) VALUES
('11111111-1111-4111-8111-000000000001','The Verge','https://www.theverge.com',false),
('11111111-1111-4111-8111-000000000001','arXiv','https://arxiv.org',false),
('11111111-1111-4111-8111-000000000002','Reuters','https://www.reuters.com',false),
('11111111-1111-4111-8111-000000000002','Financial Times','https://www.ft.com',true),
('11111111-1111-4111-8111-000000000003','Bloomberg','https://www.bloomberg.com',true),
('11111111-1111-4111-8111-000000000004','Nature','https://www.nature.com',false),
('11111111-1111-4111-8111-000000000005','STAT News','https://www.statnews.com',true),
('11111111-1111-4111-8111-000000000006','Government release','https://example.gov',false),
('11111111-1111-4111-8111-000000000007','Harvard Business Review','https://hbr.org',true),
('11111111-1111-4111-8111-000000000008','Ars Technica','https://arstechnica.com',false),
('11111111-1111-4111-8111-000000000009','The Verge','https://www.theverge.com',false);

INSERT INTO public.spot_check_queue (story_id, reason, status) VALUES
('11111111-1111-4111-8111-000000000001','Benchmark claim may be overstated in summary','pending'),
('11111111-1111-4111-8111-000000000005','Tone classification flagged as potentially too harsh','pending'),
('11111111-1111-4111-8111-000000000003','Geography tag uncertain — investors are international','pending');
