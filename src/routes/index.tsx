import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import editorialHero from "@/assets/editorial-hero.jpg";
import { FilterBar } from "@/components/FilterBar";
import { DigestSignup } from "@/components/DigestSignup";
import { StoryCard } from "@/components/StoryCard";
import { AdSlot } from "@/components/Advertising";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_OPTIONS,
  CONTENT_TYPES,
  GEOGRAPHIES,
  TONES,
  TIME_RANGES,
  TOPICS,
  emptyFilters,
  fetchStories,
  filterStories,
  type Access,
  type ContentType,
  type Filters,
  type Geography,
  type TimeRange,
  type Tone,
  type Topic,
} from "@/lib/news";

type FeedSearch = {
  topics?: string | undefined;
  tone?: string | undefined;
  access?: string | undefined;
  geo?: string | undefined;
  type?: string | undefined;
  range?: string | undefined;
  q?: string | undefined;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    topics: typeof search["topics"] === "string" ? search["topics"] : undefined,
    tone: typeof search["tone"] === "string" ? search["tone"] : undefined,
    access: typeof search["access"] === "string" ? search["access"] : undefined,
    geo: typeof search["geo"] === "string" ? search["geo"] : undefined,
    type: typeof search["type"] === "string" ? search["type"] : undefined,
    range: typeof search["range"] === "string" ? search["range"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "TheFullPicture.ai — AI news, one story at a time" },
      {
        name: "description",
        content:
          "A reverse-chronological feed of AI news with AI-written summaries, source links, and filters for topic, tone, access and geography.",
      },
      { property: "og:title", content: "TheFullPicture.ai — AI news, one story at a time" },
      {
        property: "og:description",
        content:
          "AI news grouped into single stories, with AI summaries, every source linked, and shareable filters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
});

function searchToFilters(search: FeedSearch): Filters {
  const topics = (search.topics ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is Topic => TOPICS.includes(t as Topic));
  const timeRange = TIME_RANGES.some((r) => r.value === search.range)
    ? (search.range as TimeRange)
    : null;
  return {
    topics,
    tone: TONES.includes(search.tone as Tone) ? (search.tone as Tone) : null,
    access: ACCESS_OPTIONS.includes(search.access as Access) ? (search.access as Access) : null,
    geography: GEOGRAPHIES.includes(search.geo as Geography) ? (search.geo as Geography) : null,
    contentType: CONTENT_TYPES.includes(search.type as ContentType) ? (search.type as ContentType) : null,
    timeRange,
    q: search.q ?? "",
  };
}

function filtersToSearch(filters: Filters): FeedSearch {
  const next: FeedSearch = {};
  if (filters.topics.length) next.topics = filters.topics.join(",");
  if (filters.tone) next.tone = filters.tone;
  if (filters.access) next.access = filters.access;
  if (filters.geography) next.geo = filters.geography;
  if (filters.contentType) next.type = filters.contentType;
  if (filters.timeRange) next.range = filters.timeRange;
  if (filters.q.trim()) next.q = filters.q;
  return next;
}

const DEFAULT_VIEW_KEY = "tfp:default-view";

function FeedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [appliedDefault, setAppliedDefault] = useState(false);
  const [hasSavedDefault, setHasSavedDefault] = useState(false);

  const filters = searchToFilters(search);
  const hasUrlFilters = Object.keys(filtersToSearch(filters)).length > 0;

  const { data: stories, isLoading, error } = useQuery({
    queryKey: ["stories"],
    queryFn: fetchStories,
  });

  // Apply the reader's saved default view (kept in this browser) when they
  // arrive with no filters in the address.
  useEffect(() => {
    if (appliedDefault) return;
    setAppliedDefault(true);
    let saved: Partial<Filters> | null = null;
    try {
      const raw = window.localStorage.getItem(DEFAULT_VIEW_KEY);
      saved = raw ? (JSON.parse(raw) as Partial<Filters>) : null;
    } catch {
      saved = null;
    }
    if (!saved) return;
    setHasSavedDefault(true);
    if (hasUrlFilters) return;
    const next = filtersToSearch({ ...emptyFilters, ...saved });
    if (Object.keys(next).length) navigate({ search: next, replace: true });
  }, [appliedDefault, hasUrlFilters, navigate]);

  const update = (patch: Partial<Filters>) => {
    navigate({ search: filtersToSearch({ ...filters, ...patch }), replace: true });
  };

  const reset = () => navigate({ search: {}, replace: true });

  const saveDefault = () => {
    try {
      window.localStorage.setItem(DEFAULT_VIEW_KEY, JSON.stringify(filters));
      setHasSavedDefault(true);
      toast.success("Saved on this device — this view will load next time.", {
        description:
          "It is stored in this browser only, so it won't follow you to another device and it disappears if you clear your browsing data or use private browsing.",
      });
    } catch {
      toast.error("Your browser is blocking saved settings, so this view can't be remembered.");
    }
  };

  const clearDefault = () => {
    try {
      window.localStorage.removeItem(DEFAULT_VIEW_KEY);
    } catch {
      /* ignore */
    }
    setHasSavedDefault(false);
    toast.success("Your saved view has been removed from this browser.");
    navigate({ search: {}, replace: true });
  };

  const visible = stories ? filterStories(stories, filters) : [];

  return (
    <main>
      <section className="relative isolate overflow-hidden border-b border-border">
        <img
          src={editorialHero}
          alt=""
          aria-hidden="true"
          width={1920}
          height={960}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-background/50" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-b from-background/20 to-background" aria-hidden="true" />

        <header className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Today’s full picture</p>
          <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] font-semibold tracking-normal text-foreground sm:text-6xl">
            AI news, one story at a time
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-lg leading-relaxed text-foreground/75 sm:text-xl">
            Every development grouped into a single card, summarised by AI, with every source linked.
          </p>
        </header>

        <AdSlot format="leaderboard" />

        <FilterBar
          filters={filters}
          onChange={update}
          onReset={reset}
          onSaveDefault={saveDefault}
          canSaveDefault
          onClearDefault={clearDefault}
          hasSavedDefault={hasSavedDefault}
        />
      </section>

      <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
        <div className="mb-8 flex items-center gap-1 border-b border-border" role="tablist" aria-label="Filter stories by recency">
          {[{ value: null, label: "Latest" }, ...TIME_RANGES].map(({ value, label }) => {
            const active = filters.timeRange === value;
            return (
              <button
                key={value ?? "latest"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => update({ timeRange: value as TimeRange | null })}
                className={`-mb-px border-b-2 px-4 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-brand-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {isLoading && <p className="text-muted-foreground">Loading stories…</p>}
        {error && <p className="text-destructive">Stories could not be loaded right now.</p>}
        {!isLoading && !error && visible.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No stories match these filters yet.
          </p>
        )}

        {visible.map((story, index) => (
          <div key={story.id}>
            <div id={`story-${story.id}`} className="scroll-mt-24">
              <StoryCard story={story} />
            </div>
            {index === 2 && <AdSlot format="in-feed" />}
          </div>
        ))}

        <div className="pt-10">
          <DigestSignup filters={filters} />
        </div>
        </div>
        <div className="sticky top-6 hidden lg:block">
          <AdSlot format="sidebar" />
        </div>
      </div>
    </main>
  );
}
