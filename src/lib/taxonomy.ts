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
  "Education",
  "Society & Economy",
  "Cyber Security",
  "Science & Healthcare",
] as const;
export type Topic = (typeof TOPICS)[number];
export const TOPIC_DESCRIPTIONS: Partial<Record<Topic, string>> = {
  Leadership: "AI strategy, competitive positioning and boardroom decisions.",
  Organisations: "Workforce adaptation, hiring, skills and internal AI adoption.",
  "People & Jobs":
    "Labour markets, worker displacement, reskilling and the societal impact on employment.",
  Education: "AI education, teaching, learning, curricula and skills training.",
  "Society & Economy":
    "Macroeconomic change, public services, social structures and economy-wide effects of AI.",
  "Cyber Security": "AI-enabled attacks, malware, fraud, vulnerabilities and defensive tools.",
  "Science & Healthcare":
    "AI applications and impacts in healthcare, medicine, scientific discovery and space.",
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
