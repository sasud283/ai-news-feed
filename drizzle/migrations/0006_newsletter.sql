-- Private billing state. Browser subscriber inserts cannot grant access.
REVOKE INSERT ON public.digest_subscribers FROM anon, authenticated;
DROP POLICY IF EXISTS "anyone can subscribe" ON public.digest_subscribers;
CREATE TABLE public.newsletter_checkouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 cadence text NOT NULL CHECK (cadence IN ('daily','weekly')),
 plan text NOT NULL CHECK (plan IN ('monthly','yearly')),
 topics text[] NOT NULL DEFAULT '{}',
 consented_at timestamptz NOT NULL DEFAULT now(),
 stripe_session_id text UNIQUE,
 completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.newsletter_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 cadence text NOT NULL CHECK (cadence IN ('daily','weekly')),
 topics text[] NOT NULL DEFAULT '{}',
 access_kind text NOT NULL CHECK (access_kind IN ('paid','complimentary')),
 comp_reason text,
 stripe_subscription_id text UNIQUE,
 stripe_customer_id text,
 status text NOT NULL DEFAULT 'pending',
 paid_until timestamptz,
 verified_at timestamptz,
 unsubscribed boolean NOT NULL DEFAULT false,
 first_due_at timestamptz NOT NULL DEFAULT now(),
 first_sent_at timestamptz,
 next_send_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((access_kind='complimentary' AND comp_reason IS NOT NULL AND stripe_subscription_id IS NULL)
     OR (access_kind='paid' AND stripe_subscription_id IS NOT NULL))
);
CREATE UNIQUE INDEX newsletter_comp_email_cadence ON public.newsletter_members(lower(email),cadence)
 WHERE access_kind='complimentary';
CREATE TABLE public.newsletter_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 member_id uuid NOT NULL REFERENCES public.newsletter_members(id),
 due_at timestamptz NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 attempted_at timestamptz,
 accepted_at timestamptz,
 provider_id text,
 delivery_status text NOT NULL DEFAULT 'pending',
 UNIQUE(member_id,due_at)
);
CREATE TABLE public.newsletter_events (
 event_id text PRIMARY KEY,
 received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsletter_checkouts, public.newsletter_members,
 public.newsletter_deliveries, public.newsletter_events FROM anon, authenticated;
GRANT ALL ON public.newsletter_checkouts, public.newsletter_members,
 public.newsletter_deliveries, public.newsletter_events TO service_role;
CREATE INDEX newsletter_due ON public.newsletter_members(next_send_at) WHERE NOT unsubscribed;
