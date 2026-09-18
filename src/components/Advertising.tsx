import { ArrowUpRight } from "lucide-react";

type AdSlotProps = {
  format: "leaderboard" | "sidebar" | "in-feed";
};

const copy = {
  leaderboard: {
    label: "Leaderboard",
    title: "Put your brand in the daily AI conversation",
    detail: "Premium placement · 970 × 90",
  },
  sidebar: {
    label: "Sponsor",
    title: "Reach thoughtful AI readers",
    detail: "Weekly sponsorship · 300 × 250",
  },
  "in-feed": {
    label: "Sponsored",
    title: "A considered place for an ambitious idea",
    detail: "Native placement · Clearly labelled",
  },
} as const;

export function AdSlot({ format }: AdSlotProps) {
  const content = copy[format];

  if (format === "leaderboard") {
    return (
      <aside aria-label="Advertisement" className="border-y border-ad-border bg-background">
        <div className="mx-auto flex min-h-24 max-w-6xl items-center justify-between gap-5 px-4 py-5">
          <div>
            <p className="text-[0.65rem] font-semibold tracking-widest text-ad-foreground uppercase">
              Advertisement · {content.label}
            </p>
            <p className="mt-1 font-serif text-lg font-semibold text-foreground">{content.title}</p>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">{content.detail}</p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label={format === "sidebar" ? "Sponsor advertisement" : "Sponsored placement"}
      className={`border border-ad-border bg-background ${format === "sidebar" ? "p-5" : "my-8 p-6"}`}
    >
      <p className="text-[0.65rem] font-semibold tracking-widest text-ad-foreground uppercase">
        {content.label}
      </p>
      <p className="mt-3 font-serif text-xl font-semibold leading-snug text-foreground">
        {content.title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{content.detail}</p>
      <a
        href="mailto:advertise@thefullpicture.ai"
        className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-ad-foreground underline decoration-ad-border underline-offset-4"
      >
        Advertise with us <ArrowUpRight className="h-4 w-4" />
      </a>
    </aside>
  );
}