import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Legal & Impressum — TheFullPicture.ai" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Legal & Impressum — TheFullPicture.ai" },
      {
        property: "og:description",
        content: "Legal notice and provider identification for The Full Picture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImpressumPage,
});

const SECTIONS: { heading: string; paragraphs: React.ReactNode[] }[] = [
  {
    heading: "Publisher",
    paragraphs: [
      <>
        Sarah Suda
        <br />
        Malta, EU
      </>,
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      <a href="mailto:hello@thefullpicture.ai" className="text-brand-accent hover:underline">
        hello@thefullpicture.ai
      </a>,
    ],
  },
  {
    heading: "Content & Liability",
    paragraphs: [
      "The Full Picture aggregates and summarises publicly available news and publications using automated tools. We do not claim editorial authorship of source material. All summaries are generated for informational purposes. We are not responsible for the content of external sites we link to.",
    ],
  },
  {
    heading: "Newsletter & Subscriptions",
    paragraphs: [
      "Paid newsletter subscriptions are processed via Stripe and delivered via Buttondown. Subscribers may cancel at any time. For billing queries, contact hello@thefullpicture.ai.",
    ],
  },
  {
    heading: "Privacy",
    paragraphs: [
      <>
        We collect only the email address you provide to subscribe. We do not sell or share your
        data with third parties. We use cookies on this site for analytics purposes only. For full
        details, see our{" "}
        <Link to="/privacy" className="text-brand-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </>,
    ],
  },
  {
    heading: "Copyright",
    paragraphs: [
      "The structure, design, and selection of content on this site are the work of The Full Picture. Article summaries are generated automatically from publicly available sources. Source articles remain the property of their respective publishers. Unauthorised reproduction of this site's structure or design is not permitted.",
    ],
  },
];

function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">Legal &amp; Impressum</h1>
      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        The Full Picture is an independent AI news aggregator operated by Sarah Suda, based in
        Malta, European Union.
      </p>
      <div className="mt-10 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="font-serif text-xl font-semibold text-foreground">{section.heading}</h2>
            <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 text-sm text-muted-foreground/70">Last updated: September 2026</p>
    </main>
  );
}
