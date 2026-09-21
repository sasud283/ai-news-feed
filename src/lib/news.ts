import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageDatabase } from "@/lib/storage.types";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { TOPICS, type Topic } from "@/lib/taxonomy";
export { TOPICS, TOPIC_DESCRIPTIONS, normalizeTopics } from "@/lib/taxonomy";
export type { Topic } from "@/lib/taxonomy";
export type Tone = Database["public"]["Enums"]["story_tone"] | "Cool" | "Neutral";
export type Access = Database["public"]["Enums"]["story_access"];
export type Geography = Database["public"]["Enums"]["story_geography"];
export type ContentType = "Article" | "Podcast" | "Video";

export const TONES: Tone[] = ["Good", "Useful", "Bad", "Ugly", "Cool", "Neutral"];
export const ACCESS_OPTIONS: Access[] = ["Free", "Paid"];
export const CONTENT_TYPES: ContentType[] = ["Article", "Podcast", "Video"];
export const GEOGRAPHIES: Geography[] = [
  "Worldwide",
  "US",
  "China",
  "Europe",
  "Africa",
  "Latin America",
  "South & Southeast Asia",
  "Middle East",
];

export const TONE_DESCRIPTIONS: Record<Tone, string> = {
  Good: "Demonstrated benefit for people, society, or scientific understanding.",
  Useful: "An actionable capability, resource, or guidance.",
  Cool: "A concrete creative or novel idea with wider impact unproven.",
  Neutral: "Newsworthy, with no clear positive or negative impact established.",
  Bad: "A documented failure, setback, or adverse consequence.",
  Ugly: "Serious harm, abuse, deception, or reckless conduct; requires editorial review.",
};

export const toneClass: Record<Tone, string> = {
  Good: "bg-tone-good text-tone-contrast border-tone-good",
  Useful: "bg-tone-useful text-tone-contrast border-tone-useful",
  Bad: "bg-tone-bad text-tone-contrast border-tone-bad",
  Ugly: "bg-tone-ugly text-tone-contrast border-tone-ugly",
  Cool: "bg-tone-cool text-tone-contrast border-tone-cool",
  Neutral: "bg-tone-neutral text-tone-contrast border-tone-neutral",
};

export const topicClass: Record<Topic, string> = {
  "Models & Research": "bg-topic-blue text-tone-contrast border-topic-blue",
  "Business & Funding": "bg-topic-teal text-tone-contrast border-topic-teal",
  "Policy & Regulation": "bg-topic-violet text-tone-contrast border-topic-violet",
  "National Initiatives": "bg-topic-coral text-tone-contrast border-topic-coral",
  Ethics: "bg-topic-rose text-tone-contrast border-topic-rose",
  Leadership: "bg-topic-amber text-tone-contrast border-topic-amber",
  Organisations: "bg-topic-teal text-tone-contrast border-topic-teal",
  "People & Jobs": "bg-topic-coral text-tone-contrast border-topic-coral",
  "Future of Daily Life": "bg-topic-green text-tone-contrast border-topic-green",
  "AI Equity & Representation": "bg-topic-magenta text-tone-contrast border-topic-magenta",
  "Tools & Products": "bg-topic-cyan text-tone-contrast border-topic-cyan",
  Education: "bg-topic-green text-tone-contrast border-topic-green",
};

export const topicOutlineClass: Record<Topic, string> = {
  "Models & Research": "border-topic-blue text-topic-blue",
  "Business & Funding": "border-topic-teal text-topic-teal",
  "Policy & Regulation": "border-topic-violet text-topic-violet",
  "National Initiatives": "border-topic-coral text-topic-coral",
  Ethics: "border-topic-rose text-topic-rose",
  Leadership: "border-topic-amber text-topic-dark",
  Organisations: "border-topic-teal text-topic-teal",
  "People & Jobs": "border-topic-coral text-topic-coral",
  "Future of Daily Life": "border-topic-green text-topic-green",
  "AI Equity & Representation": "border-topic-magenta text-topic-magenta",
  "Tools & Products": "border-topic-cyan text-topic-dark",
  Education: "border-topic-green text-topic-green",
};

export type StorySource = {
  id: string;
  source_name: string;
  source_url: string;
  is_paywalled: boolean | null;
};

export type Story = {
  id: string;
  headline: string;
  ai_generated_summary: string;
  published_at: string;
  updated_at: string;
  is_correction_of: string | null;
  content_type: ContentType;
  media_url: string | null;
  language: string;
  topics: Topic[];
  tone: Tone | null;
  access: Access | null;
  geography: Geography | null;
  geographies: Geography[];
  sources: StorySource[];
  followUp?: { id: string; headline: string } | null;
};

type RawStory = {
  id: string;
  headline: string;
  ai_generated_summary: string;
  published_at: string;
  updated_at: string;
  is_correction_of: string | null;
  content_type: string;
  media_url: string | null;
  language: string | null;
  story_topics: { topic: Topic }[];
  story_tags: {
    tone: Tone | null;
    access: Access | null;
    geography: Geography | null;
    secondary_geography: Geography | null;
  } | null;
  story_sources: StorySource[];
};

const SELECT =
  "id, headline, ai_generated_summary, published_at, updated_at, is_correction_of, content_type, media_url, language, story_topics(topic), story_tags(tone, access, geography, secondary_geography), story_sources(id, source_name, source_url, is_paywalled)";

export async function fetchStories(): Promise<Story[]> {
  const db = supabase as unknown as SupabaseClient<StorageDatabase>;
  const { data, error } = await db
    .from("stories")
    .select(SELECT)
    .eq("publication_status", "published")
    .order("published_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const raw = (data ?? []) as unknown as RawStory[];
  const stories: Story[] = raw.map((s) => {
    const tags = s.story_tags;
    return {
      id: s.id,
      headline: s.headline,
      ai_generated_summary: s.ai_generated_summary,
      published_at: s.published_at,
      updated_at: s.updated_at,
      is_correction_of: s.is_correction_of,
      content_type: CONTENT_TYPES.includes(s.content_type as ContentType)
        ? (s.content_type as ContentType)
        : "Article",
      media_url: s.media_url,
      language: s.language ?? "English",
      topics: (s.story_topics ?? []).map((t) => t.topic),
      tone: tags?.tone ?? null,
      access: tags?.access ?? null,
      geography: tags?.geography ?? null,
      geographies: [tags?.geography, tags?.secondary_geography].filter(
        (value): value is Geography => value !== null && value !== undefined,
      ),
      sources: s.story_sources ?? [],
    };
  });

  for (const story of stories) {
    if (story.is_correction_of) {
      const original = stories.find((o) => o.id === story.is_correction_of);
      if (original) {
        original.followUp = { id: story.id, headline: story.headline };
      }
    }
  }

  return stories;
}

export type TimeRange = "week" | "month" | "older";

export const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "older", label: "Older" },
];

export type Filters = {
  topics: Topic[];
  tone: Tone | null;
  access: Access | null;
  geography: Geography | null;
  contentType: ContentType | null;
  timeRange: TimeRange | null;
  q: string;
};

export const emptyFilters: Filters = {
  topics: [],
  tone: null,
  access: null,
  geography: null,
  contentType: null,
  timeRange: null,
  q: "",
};

export function filterStories(stories: Story[], filters: Filters): Story[] {
  const q = filters.q.trim().toLowerCase();
  return stories.filter((s) => {
    if (filters.topics.length && !filters.topics.some((t) => s.topics.includes(t))) return false;
    if (filters.tone && s.tone !== filters.tone) return false;
    if (filters.access && s.access !== filters.access) return false;
    if (filters.geography && !s.geographies.includes(filters.geography)) return false;
    if (filters.contentType && s.content_type !== filters.contentType) return false;
    if (filters.timeRange) {
      const ageDays = (Date.now() - new Date(s.published_at).getTime()) / 86_400_000;
      if (filters.timeRange === "week" && ageDays > 7) return false;
      if (filters.timeRange === "month" && ageDays > 30) return false;
      if (filters.timeRange === "older" && ageDays <= 30) return false;
    }
    if (
      q &&
      !s.headline.toLowerCase().includes(q) &&
      !s.ai_generated_summary.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
