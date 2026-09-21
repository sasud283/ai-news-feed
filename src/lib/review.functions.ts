import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

import type { StorageDatabase } from "@/lib/storage.types";

async function requireAdmin(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Administrator access required");
  return db as unknown as SupabaseClient<StorageDatabase>;
}

const correctionSchema = z.object({
  queueId: z.string().uuid(),
  summary: z.string().trim().min(1).max(4000),
  topics: z
    .array(
      z.enum([
        "Models & Research",
        "Business & Funding",
        "Policy & Regulation",
        "National Initiatives",
        "Ethics",
        "Leadership",
        "Organisations",
        "People & Jobs",
        "Future of Daily Life",
        "AI Equity & Representation",
        "Tools & Products",
        "Education",
      ]),
    )
    .min(1),
  tone: z.enum(["Good", "Useful", "Bad", "Ugly", "Cool", "Neutral"]),
  access: z.enum(["Free", "Paid"]),
  geographies: z
    .array(
      z.enum([
        "Worldwide",
        "US",
        "China",
        "Europe",
        "Africa",
        "Latin America",
        "South & Southeast Asia",
        "Middle East",
      ]),
    )
    .min(1)
    .max(2),
  publishedAt: z.string().datetime({ offset: true }),
});

export const fetchSpotCheckQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { data, error } = await db
      .from("spot_check_queue")
      .select(
        "id, reason, status, created_at, story_id, stories(id, headline, ai_generated_summary, language, published_at, related_to_url, processing_metadata, story_sources(source_name, source_url, is_paywalled), story_topics(topic), story_tags(tone, access, geography, secondary_geography))",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const fetchPublishedForEditing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { data, error } = await db
      .from("stories")
      .select(
        "id, headline, ai_generated_summary, language, published_at, related_to_url, processing_metadata, story_sources(source_name, source_url, is_paywalled), story_topics(topic), story_tags(tone, access, geography, secondary_geography)",
      )
      .eq("publication_status", "published")
      .order("published_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const queuePublishedStoryForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ storyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { error } = await db.rpc("queue_published_story_for_edit", {
      p_story_id: data.storyId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveSpotCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ queueId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { error } = await db.rpc("review_story", {
      p_queue_id: data.queueId,
      p_action: "approve",
      p_correction: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectSpotCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ queueId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { error } = await db.rpc("review_story", {
      p_queue_id: data.queueId,
      p_action: "reject",
      p_correction: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const correctSpotCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => correctionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { error } = await db.rpc("review_story", {
      p_queue_id: data.queueId,
      p_action: "correct",
      p_correction: {
        summary: data.summary,
        topics: data.topics,
        tone: data.tone,
        access: data.access,
        geographies: data.geographies,
        published_at: data.publishedAt,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePublishedStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    correctionSchema.omit({ queueId: true }).extend({ storyId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.supabase, context.userId);
    const { error } = await db.rpc("update_published_story", {
      p_story_id: data.storyId,
      p_correction: {
        summary: data.summary,
        topics: data.topics,
        tone: data.tone,
        access: data.access,
        geographies: data.geographies,
        published_at: data.publishedAt,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
