import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { TOPICS, topicClass, topicOutlineClass, type Topic } from "@/lib/news";
import {
  CADENCES,
  TIERS,
  buttondownCheckoutUrl,
  monthlyEquivalent,
  priceLabel,
  type BillingPlan,
  type Cadence,
} from "@/lib/subscription";

type SubscribeSearch = { topics?: string | undefined; cadence?: string | undefined };

export const Route = createFileRoute("/subscribe/")({
  validateSearch: (search: Record<string, unknown>): SubscribeSearch => ({
    topics: typeof search["topics"] === "string" ? search["topics"] : undefined,
    cadence: typeof search["cadence"] === "string" ? search["cadence"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Subscribe — TheFullPicture.ai newsletter" },
      {
        name: "description",
        content:
          "Choose the weekly digest (€3/month or €35/year) or the daily briefing (€5/month or €55/year). Paid from day one, billed securely by Stripe.",
      },
      { property: "og:title", content: "Subscribe — TheFullPicture.ai newsletter" },
      {
        property: "og:description",
        content: "Two paid tiers: weekly digest from €3/month, daily briefing from €5/month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscribePage,
});

function SubscribePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const initialCadence: Cadence = search.cadence === "daily" ? "daily" : "weekly";
  const initialTopics = (search.topics ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is Topic => TOPICS.includes(t as Topic));

  const [cadence, setCadence] = useState<Cadence>(initialCadence);
  const [plan, setPlan] = useState<BillingPlan>("yearly");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [allTopics, setAllTopics] = useState(initialTopics.length === 0);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(initialTopics);
  const [submitting, setSubmitting] = useState(false);

  const toggleTopic = (topic: Topic) => {
    setAllTopics(false);
    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box before subscribing.");
      return;
    }
    if (!allTopics && selectedTopics.length === 0) {
      toast.error("Choose at least one topic, or select Everything.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("digest_subscribers").insert({
      email,
      consented_at: new Date().toISOString(),
      unsubscribed: false,
      filter_preferences: {
        all_topics: allTopics,
        topics: allTopics ? [...TOPICS] : selectedTopics,
        tier: cadence,
        cadence,
        plan,
        price_eur: plan === "yearly" ? TIERS[cadence].yearly : TIERS[cadence].monthly,
        billing: "buttondown-stripe",
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "That email is already subscribed."
          : "We couldn't start your subscription. Please try again.",
      );
      return;
    }

    const checkout = buttondownCheckoutUrl(cadence, plan, email);
    if (checkout) {
      window.location.href = checkout;
      return;
    }
    navigate({ to: "/subscribe/confirmed", search: { cadence, plan } });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to the feed
      </Link>

      <header className="mt-6 max-w-2xl">
        <p className="text-xs font-semibold tracking-widest text-brand-accent uppercase">
          Newsletter
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-foreground sm:text-5xl">
          Get it delivered
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          The site stays free to read. The newsletter is a paid product from day one — no ads inside
          it, no filler, every story with its sources linked. Billing is handled securely by Stripe
          through Buttondown.
        </p>
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          And it goes further than the brief in your inbox: your subscription is what keeps the AI
          pipeline running and the site alive — the polling of hundreds of sources, the story
          grouping, the summaries and the human spot checks. Paid readers fund the whole picture —
          and at €3 a month, that's roughly the price of a coffee.
        </p>
      </header>

      <div className="mt-8 inline-flex rounded-md border border-border p-1">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPlan(option)}
            className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${
              plan === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option === "monthly" ? "Monthly" : "Annual · save 2 months"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        <fieldset>
          <legend className="sr-only">Choose your frequency</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {CADENCES.map((option) => {
              const tier = TIERS[option];
              const active = cadence === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCadence(option)}
                  className={`rounded-md border p-6 text-left transition-colors ${
                    active
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <strong className="font-serif text-2xl text-foreground">{tier.name}</strong>
                    {active && <Check className="size-5" />}
                  </span>
                  <span className="mt-3 block font-serif text-3xl text-foreground">
                    {priceLabel(option, plan)}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {plan === "yearly"
                      ? `€${monthlyEquivalent(option)}/month, billed yearly`
                      : `or €${tier.yearly}/year`}
                  </span>
                  <span className="mt-4 block space-y-2">
                    {tier.points.map((point) => (
                      <span
                        key={point}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-brand-accent" />
                        {point}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Topics in your brief
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={allTopics ? "default" : "outline"}
              className={
                allTopics ? "bg-filter-active text-tone-contrast hover:bg-filter-active/90" : ""
              }
              onClick={() => {
                setAllTopics(true);
                setSelectedTopics([]);
              }}
            >
              {allTopics && <Check />}
              All Topics / Everything
            </Button>
            {TOPICS.map((topic) => {
              const active = !allTopics && selectedTopics.includes(topic);
              return (
                <Button
                  key={topic}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={active ? topicClass[topic] : topicOutlineClass[topic]}
                  onClick={() => toggleTopic(topic)}
                >
                  {active && <Check />}
                  {topic}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div className="max-w-md">
          <label
            htmlFor="subscribe-email"
            className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Email address
          </label>
          <Input
            id="subscribe-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 bg-background"
          />
        </div>

        <label className="flex max-w-xl items-start gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
            className="mt-0.5"
          />
          <span>
            I agree to receive the TheFullPicture.ai newsletter and to the{" "}
            <Link to="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </span>
        </label>

        <div className="max-w-md">
          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full bg-primary text-primary-foreground hover:bg-brand-accent"
          >
            <CreditCard />
            {submitting
              ? "Starting checkout…"
              : `Continue to payment — ${TIERS[cadence].name}, ${priceLabel(cadence, plan)}`}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Secure checkout by Stripe via Buttondown. Cancel any time.
          </p>
        </div>
      </form>
    </main>
  );
}
