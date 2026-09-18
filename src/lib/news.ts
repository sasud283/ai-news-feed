import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Topic = Database["public"]["Enums"]["story_topic"];
export type Tone = Database["public"]["Enums"]["story_tone"];
export type Access = Database["public"]["Enums"]["story_access"];
export type Geography = Database["public"]["Enums"]["story_geography"];

export const TOPICS: Topic[] = [
  "Models & Research",
  "Business & Funding",
  "Policy & Regulation",
  "National Initiatives",
  "Ethics",
  "Future of Work",
  "Future of Daily Life",
  "AI Equity & Representation",
  "Tools & Products",
];

export const TONES: Tone[] = ["Good", "Useful", "Bad", "Ugly"];
export const ACCESS_OPTIONS: Access[] = ["Free", "Paid"];
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

export const toneClass: Record<Tone, string> = {
  Good: "bg-tone-good/15 text-tone-good border-tone-good/30",
  Useful: "bg-tone-useful/15 text-tone-useful border-tone-useful/30",
  Bad: "bg-tone-bad/15 text-tone-bad border-tone-bad/30",
  Ugly: "bg-tone-ugly/15 text-tone-ugly border-tone-ugly/30",
};

export type StorySource = {
  id: string;
  source_name: string;
  source_url: string;
  is_paywalled: boolean;
};

export type Story = {
  id: string;
  headline: string;
  ai_generated_summary: string;
  published_at: string;
  updated_at: string;
  is_correction_of: string | null;
  topics: Topic[];
  tone: Tone | null;
  access: Access | null;
  geography: Geography | null;
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
  story_topics: { topic: Topic }[];
  story_tags: { tone: Tone; access: Access; geography: Geography }[];
  story_sources: StorySource[];
};

const SELECT =
  "id, headline, ai_generated_summary, published_at, updated_at, is_correction_of, story_topics(topic), story_tags(tone, access, geography), story_sources(id, source_name, source_url, is_paywalled)";

export async function fetchStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select(SELECT)
    .order("published_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const raw = (data ?? []) as unknown as RawStory[];
  const stories: Story[] = raw.map((s) => {
    const tags = s.story_tags?.[0];
    return {
      id: s.id,
      headline: s.headline,
      ai_generated_summary: s.ai_generated_summary,
      published_at: s.published_at,
      updated_at: s.updated_at,
      is_correction_of: s.is_correction_of,
      topics: (s.story_topics ?? []).map((t) => t.topic),
      tone: tags?.tone ?? null,
      access: tags?.access ?? null,
      geography: tags?.geography ?? null,
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

export type Filters = {
  topics: Topic[];
  tone: Tone | null;
  access: Access | null;
  geography: Geography | null;
  q: string;
};

export const emptyFilters: Filters = {
  topics: [],
  tone: null,
  access: null,
  geography: null,
  q: "",
};

export function filterStories(stories: Story[], filters: Filters): Story[] {
  const q = filters.q.trim().toLowerCase();
  return stories.filter((s) => {
    if (filters.topics.length && !filters.topics.some((t) => s.topics.includes(t))) return false;
    if (filters.tone && s.tone !== filters.tone) return false;
    if (filters.access && s.access !== filters.access) return false;
    if (filters.geography && s.geography !== filters.geography) return false;
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
