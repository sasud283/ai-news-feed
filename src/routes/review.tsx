import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveSpotCheck,
  rejectSpotCheck,
  correctSpotCheck,
  fetchPublishedForEditing,
  fetchSpotCheckQueue,
  queuePublishedStoryForEdit,
} from "@/lib/review.functions";
import {
  ACCESS_OPTIONS,
  CONTENT_TYPES,
  GEOGRAPHIES,
  TONES,
  TONE_DESCRIPTIONS,
  TOPICS,
  formatDate,
  toneClass,
  type Access,
  type ContentType,
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
    language: string;
    content_type: ContentType;
    media_url: string | null;
    published_at: string | null;
    related_to_url: string | null;
    processing_metadata?: {
      classification?: { tone_reason?: string };
      tone_reassessment?: { reason?: string };
    };
    story_sources: { source_name: string; source_url: string; is_paywalled: boolean | null }[];
    story_topics: { topic: Topic }[];
    story_tags: {
      tone: Tone | null;
      access: Access | null;
      geography: Geography | null;
      secondary_geography: Geography | null;
    } | null;
  };
};

function ReviewPage() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const loadQueue = useServerFn(fetchSpotCheckQueue);
  const { data, isLoading, error } = useQuery({
    queryKey: ["spot-check-queue", user?.id],
    enabled: !loading && isAdmin,
    queryFn: async () => (await loadQueue()) as unknown as QueueItem[],
  });
  const loadPublished = useServerFn(fetchPublishedForEditing);
  const queuePublished = useServerFn(queuePublishedStoryForEdit);
  const { data: published, isLoading: publishedLoading } = useQuery({
    queryKey: ["published-for-editing", user?.id],
    enabled: !loading && isAdmin,
    queryFn: async () =>
      (await loadPublished()) as unknown as {
        id: string;
        headline: string;
        published_at: string;
      }[],
  });
  const [queueingId, setQueueingId] = useState<string | null>(null);

  const beginPublishedEdit = async (storyId: string) => {
    setQueueingId(storyId);
    try {
      await queuePublished({ data: { storyId } });
      await queryClient.invalidateQueries({ queryKey: ["spot-check-queue"] });
      toast.success("Story added to the editor above.");
    } catch {
      toast.error("Could not open this story for editing.");
    } finally {
      setQueueingId(null);
    }
  };

  if (loading) return <main className="p-8">Checking access…</main>;
  if (!user)
    return (
      <main className="p-8">
        <a href="/auth" className="underline">
          Sign in
        </a>{" "}
        to review stories.
      </main>
    );
  if (!isAdmin)
    return <main className="p-8">Administrator access is required to review stories.</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        Administrator review — flagged stories stay private until approved.
      </div>

      <a href="/subscribers" className="mt-4 inline-block underline">
        Newsletter subscribers
      </a>
      <h1 className="mt-6 font-serif text-4xl font-semibold">Spot-check queue</h1>
      <p className="mt-2 text-muted-foreground">
        Check the summary and tags, complete any missing details, then publish or reject the story.
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

      <section className="mt-14 border-t border-border pt-8">
        <h2 className="font-serif text-3xl font-semibold">Edit a published story</h2>
        <p className="mt-2 text-muted-foreground">
          Open a published story in the editor without taking it off the public feed.
        </p>
        <div className="mt-5 space-y-3">
          {publishedLoading && <p className="text-muted-foreground">Loading published stories…</p>}
          {(published ?? []).map((story) => (
            <div
              key={story.id}
              className="flex items-center justify-between gap-4 rounded border border-border p-3"
            >
              <span>{story.headline}</span>
              <Button
                variant="outline"
                onClick={() => beginPublishedEdit(story.id)}
                disabled={queueingId === story.id}
              >
                Edit
              </Button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function QueueCard({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const tags = item.stories.story_tags;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(item.stories.ai_generated_summary);
  const [topics, setTopics] = useState<Topic[]>(item.stories.story_topics.map((t) => t.topic));
  const [tone, setTone] = useState<Tone | null>(tags?.tone ?? null);
  const [contentType, setContentType] = useState<ContentType>(item.stories.content_type);
  const [access, setAccess] = useState<Access | null>(tags?.access ?? null);
  const [geographies, setGeographies] = useState<Geography[]>(
    [tags?.geography, tags?.secondary_geography].filter(
      (value): value is Geography => value !== null && value !== undefined,
    ),
  );

  const [publishedAt, setPublishedAt] = useState(item.stories.published_at ?? "");
  const missingFields = [
    !summary.trim() && "summary",
    !topics.length && "at least one topic",
    !tone && "tone",
    !access && "access (Free or Paid)",
    !geographies.length && "at least one geography",
    (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) && "valid publication date",
  ].filter((field): field is string => Boolean(field));
  const complete = missingFields.length === 0;
  const savedMissingFields = [
    !item.stories.ai_generated_summary.trim() && "summary",
    !item.stories.story_topics.length && "at least one topic",
    !tags?.tone && "tone",
    !tags?.access && "access (Free or Paid)",
    !tags?.geography && "geography",
    (!item.stories.published_at || !Number.isFinite(Date.parse(item.stories.published_at))) &&
      "valid publication date",
  ].filter((field): field is string => Boolean(field));
  const runReject = useServerFn(rejectSpotCheck);
  const reject = async () => {
    setBusy(true);
    try {
      await runReject({ data: { queueId: item.id } });
      toast.success("Story rejected.");
      onDone();
    } catch {
      toast.error("Could not reject this story.");
    } finally {
      setBusy(false);
    }
  };

  const runApprove = useServerFn(approveSpotCheck);
  const runCorrect = useServerFn(correctSpotCheck);

  const approve = async () => {
    setBusy(true);
    try {
      await runApprove({ data: { queueId: item.id } });
      toast.success("Published.");
      onDone();
    } catch {
      toast.error("Could not approve this story.");
    } finally {
      setBusy(false);
    }
  };

  const correctAndApprove = async () => {
    if (!complete || !tone || !access || !geographies.length) return;
    setBusy(true);
    try {
      await runCorrect({
        data: {
          queueId: item.id,
          publishedAt: new Date(publishedAt).toISOString(),
          summary,
          topics,
          tone,
          contentType,
          access,
          geographies,
        },
      });
      toast.success("Saved and published.");
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
        {item.stories.published_at
          ? `Published ${formatDate(item.stories.published_at)}`
          : "Publication date needs verification"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Language: {item.stories.language}</p>

      <ul className="mt-3 space-y-1 text-sm">
        {item.stories.story_sources.map((source, index) => (
          <li key={`${source.source_url}-${index}`}>
            <a
              className="underline"
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.source_name}
            </a>
            {source.is_paywalled === null
              ? " · access unverified"
              : source.is_paywalled
                ? " · paid"
                : " · free"}
          </li>
        ))}
      </ul>
      {item.stories.related_to_url && (
        <p className="mt-2 text-sm">
          Possible follow-up:{" "}
          <a
            className="underline"
            href={item.stories.related_to_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            compare the earlier story
          </a>
          . This is not a confirmed correction.
        </p>
      )}
      {(item.stories.processing_metadata?.tone_reassessment?.reason ||
        item.stories.processing_metadata?.classification?.tone_reason) && (
        <p className="mt-3 text-sm text-muted-foreground">
          Impact assessment:{" "}
          {item.stories.processing_metadata?.tone_reassessment?.reason ||
            item.stories.processing_metadata?.classification?.tone_reason}
        </p>
      )}
      {editing ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            Publication date and time (include timezone)
            <input
              className="mt-1 block w-full rounded border p-2"
              value={publishedAt}
              onChange={(event) => setPublishedAt(event.target.value)}
              placeholder="2026-09-18T10:00:00Z"
            />
          </label>
          {!complete && (
            <p className="text-sm text-muted-foreground">
              Still needed: {missingFields.join(", ")}.
            </p>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Summary
            </p>
            <Textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Content type
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={chip(contentType === type)}
                  onClick={() => setContentType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
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
              Impact label
            </p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  title={TONE_DESCRIPTIONS[t]}
                  className={chip(tone === t)}
                  onClick={() => setTone(t)}
                >
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
              Geography (choose up to two)
            </p>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={chip(geographies.includes(g))}
                  onClick={() =>
                    setGeographies((current) => {
                      if (current.includes(g)) return current.filter((value) => value !== g);
                      if (g === "Worldwide") return [g];
                      const withoutWorldwide = current.filter((value) => value !== "Worldwide");
                      return withoutWorldwide.length < 2
                        ? [...withoutWorldwide, g]
                        : withoutWorldwide;
                    })
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={correctAndApprove} disabled={busy || !complete}>
              Save and publish
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
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs">
              {item.stories.content_type}
            </span>
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
            {tags?.secondary_geography && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {tags.secondary_geography}
              </span>
            )}
            {tags?.access && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {tags.access}
              </span>
            )}
          </div>
          {savedMissingFields.length > 0 && (
            <p
              role="status"
              className="mt-4 rounded border border-border bg-secondary/40 p-3 text-sm"
            >
              Before publishing, choose {savedMissingFields.join(", ")}.
              {!tags?.access &&
                " Free means at least one source can be read without payment; Paid means payment is required."}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={savedMissingFields.length ? () => setEditing(true) : approve}
              disabled={busy}
            >
              {savedMissingFields.length ? "Complete details to publish" : "Publish"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
              Edit and publish
            </Button>
            <Button variant="ghost" onClick={reject} disabled={busy}>
              Reject
            </Button>
          </div>
        </>
      )}
    </article>
  );
}
