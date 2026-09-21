/** Editorial categories in display and classifier-ID order. */
export const TOPICS = [
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
] as const;
export type Topic = (typeof TOPICS)[number];
export const TOPIC_DESCRIPTIONS: Partial<Record<Topic, string>> = {
  Leadership: "AI strategy, competitive positioning and boardroom decisions.",
  Organisations: "Workforce adaptation, hiring, skills and internal AI adoption.",
  "People & Jobs":
    "Labour markets, worker displacement, reskilling and the societal impact on employment.",
};

/** Preserve the scope of old bookmarks and saved preferences during migration. */
export function normalizeTopics(values: readonly string[]): Topic[] {
  const expanded = values.flatMap((value) =>
    value.trim() === "Future of Work"
      ? ["Leadership", "Organisations", "People & Jobs"]
      : [value.trim()],
  );
  return [...new Set(expanded.filter((value): value is Topic => TOPICS.includes(value as Topic)))];
}
