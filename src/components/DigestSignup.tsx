import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import type { Filters } from "@/lib/news";
import { CADENCES, TIERS } from "@/lib/subscription";

/**
 * Homepage call-to-action for the paid newsletter. The signup and payment flow
 * lives on /subscribe.
 */
export function DigestSignup({ filters }: { filters: Filters }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card/60">
      <div className="border-b border-border px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold tracking-widest text-digest-foreground uppercase">
          TheFullPicture.ai newsletter
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-foreground">The brief, in your inbox</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Reading the site is free. The newsletter is a paid product — no ads in it, no filler, every story
          with its sources linked.
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/80">
          More than a newsletter: your subscription is what keeps the whole operation running — fetching
          sources, grouping stories, writing summaries and spot-checking them. Subscribers keep
          TheFullPicture.ai alive.
        </p>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <ul className="grid gap-3 sm:grid-cols-2">
          {CADENCES.map((cadence) => {
            const tier = TIERS[cadence];
            return (
              <li key={tier.id} className="rounded-md border border-border p-4">
                <strong className="font-serif text-lg text-foreground">{tier.name}</strong>
                <span className="mt-1 block text-sm text-muted-foreground">
                  €{tier.monthly}/month or €{tier.yearly}/year
                </span>
                <span className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-accent" />
                  {tier.blurb}
                </span>
              </li>
            );
          })}
        </ul>

        <Link
          to="/subscribe"
          search={{
            ...(filters.topics.length ? { topics: filters.topics.join(",") } : {}),
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-accent"
        >
          Get it delivered — from €3/month
          <ArrowRight className="size-4" />
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          From €3 a month — about the price of a coffee. Choose weekly or daily at signup. Cancel any time.
        </p>
      </div>
    </section>
  );
}
