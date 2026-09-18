import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Spot-check queue — The AI Brief" },
      { name: "description", content: "Editor review queue for flagged AI-generated summaries." },
      { property: "og:title", content: "Spot-check queue — The AI Brief" },
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

async function fetchQueue(): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from("spot_check_queue")
    .select(
      "id, reason, status, created_at, story_id, stories(id, headline, ai_generated_summary, published_at, story_topics(topic), story_tags(tone, access, geography))",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QueueItem[];
}

function ReviewPage() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["spot-check-queue"], queryFn: fetchQueue });

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-16">Checking access…</main>;

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-serif text-3xl font-semibold">Editors only</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not have reviewer access to the spot-check queue.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">Spot-check queue</h1>
      <p className="mt-2 text-muted-foreground">
        Approve a flagged story as-is, or correct its summary and tags before approving.
      </p>

      <div className="mt-8 space-y-6">
        {isLoading && <p className="text-muted-foreground">Loading queue…</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="text-muted-foreground">Nothing waiting for review. 🎉</p>
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

  const approve = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("spot_check_queue")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      toast.error("Could not approve this story.");
      return;
    }
    toast.success("Approved.");
    onDone();
  };

  const correctAndApprove = async () => {
    setBusy(true);
    const storyId = item.stories.id;

    const { error: storyError } = await supabase
      .from("stories")
      .update({ ai_generated_summary: summary, updated_at: new Date().toISOString() })
      .eq("id", storyId);

    const { error: tagError } = await supabase
      .from("story_tags")
      .upsert({ story_id: storyId, tone, access, geography }, { onConflict: "story_id" });

    const { error: deleteError } = await supabase
      .from("story_topics")
      .delete()
      .eq("story_id", storyId);

    const { error: insertError } = topics.length
      ? await supabase.from("story_topics").insert(topics.map((topic) => ({ story_id: storyId, topic })))
      : { error: null };

    const { error: queueError } = await supabase
      .from("spot_check_queue")
      .update({ status: "corrected", reviewed_at: new Date().toISOString() })
      .eq("id", item.id);

    setBusy(false);
    if (storyError || tagError || deleteError || insertError || queueError) {
      toast.error("Could not save the correction.");
      return;
    }
    toast.success("Corrected and approved.");
    onDone();
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
