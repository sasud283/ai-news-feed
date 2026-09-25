import { normalizeTopics, TOPIC_DESCRIPTIONS } from "@/lib/taxonomy";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TOPICS, topicClass, topicOutlineClass, type Topic } from "@/lib/news";
import {
  CADENCES,
  TIERS,
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
        content: `Choose the weekly digest (€${TIERS.weekly.monthly}/month or €${TIERS.weekly.yearly}/year) or the daily briefing (€${TIERS.daily.monthly}/month or €${TIERS.daily.yearly}/year). Subscriptions are coming soon.`,
      },
      { property: "og:title", content: "Subscribe — TheFullPicture.ai newsletter" },
      {
        property: "og:description",
        content: `Two paid tiers: weekly digest from €${TIERS.weekly.monthly}/month, daily briefing from €${TIERS.daily.monthly}/month.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscribePage,
});

function SubscribePage() {
  const search = Route.useSearch();
  const [available, setAvailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/newsletter/availability")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAvailable(data.enabled === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const initialCadence: Cadence = search.cadence === "daily" ? "daily" : "weekly";
  const initialTopics = normalizeTopics((search.topics ?? "").split(","));

  const [cadence, setCadence] = useState<Cadence>(initialCadence);
  const [plan, setPlan] = useState<BillingPlan>("yearly");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [allTopics, setAllTopics] = useState(initialTopics.length === 0);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(initialTopics);

  const toggleTopic = (topic: Topic) => {
    setAllTopics(false);
    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!available || submitting) return;
    if (!consent || (!allTopics && selectedTopics.length === 0)) {
      toast.error("Please select your topics and agree to receive the newsletter.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/newsletter/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          cadence,
          plan,
          topics: allTopics ? [] : selectedTopics,
          consent,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error ?? "Checkout is unavailable.");
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout is unavailable.");
    } finally {
      setSubmitting(false);
    }
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
          The site stays free to read. The planned newsletter is a paid product — no ads inside it,
          no filler, every story with its sources linked. Subscriptions will open once payment and
          email delivery are ready.
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
            {option === "monthly" ? "Monthly" : "Annual"}
          </button>
        ))}
      </div>

      <p role="status" className="mt-6 rounded-md border border-border bg-muted/50 p-4 text-sm">
        {available
          ? "Your first edition will be sent within 24 hours of confirmed payment, followed by your chosen daily or weekly schedule."
          : "Newsletter subscriptions are coming soon. You can explore plans and topics, but payments are not open yet."}
      </p>

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
                  title={TOPIC_DESCRIPTIONS[topic]}
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
            I agree to receive TheFullPicture.ai's newsletter and to the{" "}
            <Link to="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </span>
        </label>

        <div className="max-w-md">
          <Button
            type="submit"
            disabled={!available || submitting}
            className="h-12 w-full bg-primary text-primary-foreground hover:bg-brand-accent"
          >
            <CreditCard />
            {submitting
              ? "Opening checkout…"
              : available
                ? "Continue to secure payment"
                : "Newsletter coming soon"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {available
              ? "Secure payment through Stripe. Manage billing from your newsletter."
              : "Checkout is not open yet."}
          </p>
        </div>
      </form>
    </main>
  );
}
