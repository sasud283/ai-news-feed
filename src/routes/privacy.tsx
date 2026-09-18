import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — TheFullPicture.ai" },
      {
        name: "description",
        content:
          "How TheFullPicture.ai handles email addresses, digest consent and filter preferences.",
      },
      { property: "og:title", content: "Privacy policy — TheFullPicture.ai" },
      {
        property: "og:description",
        content: "How we handle your email address, consent and digest preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">Privacy policy</h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground">What we collect</h2>
          <p className="mt-2">
            If you subscribe to TheFullPicture.ai's paid email digest, we store your email address, the date and time you
            gave consent, the subscription plan, and the filter combination that was active when you signed up. Payment details are handled by the payment provider and are not stored here. If you
            create a reader account, we also store your account email and any saved default filter
            view.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground">How we use it</h2>
          <p className="mt-2">
            Your email address is used only to send the digest you asked for. Filter preferences are
            used to decide which stories appear in that digest. We do not sell or share this
            information with advertisers.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground">Consent and opt-out</h2>
          <p className="mt-2">
            We only add you to the digest when you actively tick the consent box — it is never
            pre-ticked. Every digest includes an unsubscribe link, and unsubscribing stops all
            further email immediately. You can ask us to delete your record entirely at any time.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground">Reading the site</h2>
          <p className="mt-2">
            You can browse, filter and search the feed without an account and without giving us any
            personal information.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            Questions or deletion requests: privacy@thefullpicture.ai. This is a demonstration
            contact address.
          </p>
        </section>
      </div>
    </main>
  );
}
