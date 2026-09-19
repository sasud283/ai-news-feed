import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Legal notice (Impressum) — TheFullPicture.ai" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Legal notice (Impressum) — TheFullPicture.ai" },
      { property: "og:description", content: "Legal notice and provider identification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImpressumPage,
});

function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">Legal notice (Impressum)</h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>Placeholder — the legal notice text will be added here.</p>
      </div>
    </main>
  );
}
