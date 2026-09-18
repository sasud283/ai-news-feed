import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveSpotCheck,
  correctSpotCheck,
  fetchSpotCheckQueue,
} from "@/lib/review.functions";
import {
  ACCESS_OPTIONS,
  GEOGRAPHIES,
  TONES,
  TOPICS,
  formatDate,
  toneClass,
  type Access,
  type Geography,
  type Tone,
  type Topic,
} from "@/lib/news";

export const Route = createFileRoute("/review")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Spot-check queue — TheFullPicture.ai" },
      { name: "description", content: "Editor review queue for flagged AI-generated summaries." },
      { property: "og:title", content: "Spot-check queue — TheFullPicture.ai" },
      { property: "og:description", content: "Editor review queue for flagged summaries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewPage,
});

type QueueItem = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  story_id: string;
  stories: {
    id: string;
    headline: string;
    ai_generated_summary: string;
    published_at: string;
    story_topics: { topic: Topic }[];
    story_tags: { tone: Tone; access: Access; geography: Geography }[];
  };
};

function ReviewPage() {
  const queryClient = useQueryClient();
  const loadQueue = useServerFn(fetchSpotCheckQueue);
  const { data, isLoading, error } = useQuery({
    queryKey: ["spot-check-queue"],
    queryFn: async () => (await loadQueue()) as unknown as QueueItem[],
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        Preview mode — this page is not password protected yet.
      </div>

      <h1 className="mt-6 font-serif text-4xl font-semibold">Spot-check queue</h1>
      <p className="mt-2 text-muted-foreground">
        Approve a flagged story as-is, or correct its summary and tags before approving.
      </p>

      <div className="mt-8 space-y-6">
        {isLoading && <p className="text-muted-foreground">Loading queue…</p>}
        {error && <p className="text-destructive">Could not load the queue.</p>}
        {!isLoading && !error && (data ?? []).length === 0 && (
          <p className="text-muted-foreground">Nothing waiting for review.</p>
        )}
        {(data ?? []).map((item) => (
          <QueueCard
            key={item.id}
            item={item}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["spot-check-queue"] });
              queryClient.invalidateQueries({ queryKey: ["stories"] });
            }}
          />
        ))}
      </div>
    </main>
  );
}

function QueueCard({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const tags = item.stories.story_tags?.[0];
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(item.stories.ai_generated_summary);
  const [topics, setTopics] = useState<Topic[]>(item.stories.story_topics.map((t) => t.topic));
  const [tone, setTone] = useState<Tone>(tags?.tone ?? "Useful");
  const [access, setAccess] = useState<Access>(tags?.access ?? "Free");
  const [geography, setGeography] = useState<Geography>(tags?.geography ?? "Worldwide");

  const runApprove = useServerFn(approveSpotCheck);
  const runCorrect = useServerFn(correctSpotCheck);

  const approve = async () => {
    setBusy(true);
    try {
      await runApprove({ data: { queueId: item.id } });
      toast.success("Approved.");
      onDone();
    } catch {
      toast.error("Could not approve this story.");
    } finally {
      setBusy(false);
    }
  };

  const correctAndApprove = async () => {
    setBusy(true);
    try {
      await runCorrect({
        data: {
          queueId: item.id,
          storyId: item.stories.id,
          summary,
          topics,
          tone,
          access,
          geography,
        },
      });
      toast.success("Corrected and approved.");
      onDone();
    } catch {
      toast.error("Could not save the correction.");
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background text-muted-foreground hover:text-foreground"
    }`;

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Flagged: {item.reason}
      </p>
      <h2 className="mt-2 font-serif text-2xl leading-snug font-semibold">
        {item.stories.headline}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Published {formatDate(item.stories.published_at)}
      </p>

      {editing ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Summary
            </p>
            <Textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Topics
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={chip(topics.includes(t))}
                  onClick={() =>
                    setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t])
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Tone
            </p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button key={t} type="button" className={chip(tone === t)} onClick={() => setTone(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Access
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCESS_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={chip(access === a)}
                  onClick={() => setAccess(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Geography
            </p>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={chip(geography === g)}
                  onClick={() => setGeography(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={correctAndApprove} disabled={busy}>
              Save correction & approve
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {item.stories.ai_generated_summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags?.tone && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass[tags.tone]}`}
              >
                {tags.tone}
              </span>
            )}
            {item.stories.story_topics.map((t) => (
              <span
                key={t.topic}
                className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs"
              >
                {t.topic}
              </span>
            ))}
            {tags?.geography && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {tags.geography}
              </span>
            )}
            {tags?.access && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {tags.access}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={approve} disabled={busy}>
              Approve
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
              Correct and approve
            </Button>
          </div>
        </>
      )}
    </article>
  );
}
