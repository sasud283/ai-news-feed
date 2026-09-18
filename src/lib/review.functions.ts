import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const correctionSchema = z.object({
  queueId: z.string().uuid(),
  storyId: z.string().uuid(),
  summary: z.string().min(1),
  topics: z.array(z.string()),
  tone: z.string(),
  access: z.string(),
  geography: z.string(),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const fetchSpotCheckQueue = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("spot_check_queue")
    .select(
      "id, reason, status, created_at, story_id, stories(id, headline, ai_generated_summary, published_at, story_topics(topic), story_tags(tone, access, geography))",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const approveSpotCheck = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ queueId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("spot_check_queue")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", data.queueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const correctSpotCheck = createServerFn({ method: "POST" })
  .inputValidator((data) => correctionSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();

    const { error: storyError } = await db
      .from("stories")
      .update({ ai_generated_summary: data.summary, updated_at: new Date().toISOString() })
      .eq("id", data.storyId);
    if (storyError) throw new Error(storyError.message);

    const { error: tagError } = await db
      .from("story_tags")
      .upsert(
        {
          story_id: data.storyId,
          tone: data.tone as never,
          access: data.access as never,
          geography: data.geography as never,
        },
        { onConflict: "story_id" },
      );
    if (tagError) throw new Error(tagError.message);

    const { error: deleteError } = await db
      .from("story_topics")
      .delete()
      .eq("story_id", data.storyId);
    if (deleteError) throw new Error(deleteError.message);

    if (data.topics.length) {
      const { error: insertError } = await db
        .from("story_topics")
        .insert(data.topics.map((topic) => ({ story_id: data.storyId, topic: topic as never })));
      if (insertError) throw new Error(insertError.message);
    }

    const { error: queueError } = await db
      .from("spot_check_queue")
      .update({ status: "corrected", reviewed_at: new Date().toISOString() })
      .eq("id", data.queueId);
    if (queueError) throw new Error(queueError.message);

    return { ok: true };
  });
