import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/subscribe/confirmed")({
  head: () => ({
    meta: [
      { title: "Newsletter status — TheFullPicture.ai" },
      {
        name: "description",
        content: "Payment confirmation is processed securely before newsletter activation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmedPage,
});

function ConfirmedPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-md border border-border bg-card/60 p-8">
        <Mail className="size-10 text-brand-accent" />
        <h1 className="mt-4 font-serif text-4xl font-semibold text-foreground">
          Checking your subscription
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          If your payment succeeded, your first daily or weekly edition will be sent within 24
          hours. We verify payment with Stripe before activating delivery. Visiting this page alone
          does not activate a subscription.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          If you have already paid through a payment provider, check your receipt and subscription
          status with that provider.
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
