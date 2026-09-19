import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Mail } from "lucide-react";
import { TIERS, priceLabel, type BillingPlan, type Cadence } from "@/lib/subscription";

type ConfirmedSearch = { cadence?: string | undefined; plan?: string | undefined };

export const Route = createFileRoute("/subscribe/confirmed")({
  validateSearch: (search: Record<string, unknown>): ConfirmedSearch => ({
    cadence: typeof search["cadence"] === "string" ? search["cadence"] : undefined,
    plan: typeof search["plan"] === "string" ? search["plan"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "You're subscribed — TheFullPicture.ai" },
      {
        name: "description",
        content: "Your TheFullPicture.ai newsletter subscription is confirmed. Here's when your first send arrives.",
      },
      { property: "og:title", content: "You're subscribed — TheFullPicture.ai" },
      {
        property: "og:description",
        content: "Subscription confirmed — your chosen cadence and first send timing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmedPage,
});

function ConfirmedPage() {
  const search = Route.useSearch();
  const cadence: Cadence = search.cadence === "daily" ? "daily" : "weekly";
  const plan: BillingPlan = search.plan === "monthly" ? "monthly" : "yearly";
  const tier = TIERS[cadence];

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-md border border-border bg-card/60 p-8">
        <CheckCircle2 className="size-10 text-brand-accent" />
        <h1 className="mt-4 font-serif text-4xl font-semibold text-foreground">You're subscribed</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Thank you — your subscription to the <strong className="text-foreground">{tier.name}</strong> is
          confirmed at {priceLabel(cadence, plan)}.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border p-4">
            <dt className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Your cadence</dt>
            <dd className="mt-1 font-serif text-xl text-foreground">{tier.name}</dd>
            <dd className="mt-1 text-sm text-muted-foreground">{tier.blurb}</dd>
          </div>
          <div className="rounded-md border border-border p-4">
            <dt className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">First send</dt>
            <dd className="mt-1 flex items-start gap-2 text-sm text-foreground">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand-accent" />
              {tier.firstSend}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-muted-foreground">
          Your subscription doesn't just land the brief in your inbox — it keeps the AI pipeline running and
          TheFullPicture.ai alive. Thank you for backing it.
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          A receipt from Stripe and a welcome email are on their way. If the welcome email hasn't landed within a
          few minutes, check your spam folder and add us to your contacts so future sends arrive cleanly. You can
          change cadence or cancel any time from the link at the foot of every email.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-accent"
        >
          Back to the feed
        </Link>
      </div>
    </main>
  );
}
