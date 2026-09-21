export type Cadence = "weekly" | "daily";
export type BillingPlan = "monthly" | "yearly";

export type TierInfo = {
  id: Cadence;
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  points: string[];
  firstSend: string;
};

export const TIERS: Record<Cadence, TierInfo> = {
  weekly: {
    id: "weekly",
    name: "Weekly digest",
    blurb: "One considered round-up, every Friday morning.",
    monthly: 3,
    yearly: 35,
    points: [
      "The week's AI stories, grouped and summarised",
      "Every source linked, paywalls flagged",
      "Filtered to the topics you choose",
    ],
    firstSend:
      "Your first digest arrives within 24 hours of payment, then Fridays at 07:00 Malta time.",
  },
  daily: {
    id: "daily",
    name: "Daily briefing",
    blurb: "The full picture in your inbox every weekday morning.",
    monthly: 5,
    yearly: 55,
    points: [
      "Every weekday, before the news cycle turns",
      "Every source linked, paywalls flagged",
      "Filtered to the topics you choose",
      "Includes the Friday weekly round-up",
    ],
    firstSend:
      "Your first briefing arrives within 24 hours of payment, then weekdays at 07:00 Malta time.",
  },
};

export const CADENCES: Cadence[] = ["weekly", "daily"];

export function priceFor(cadence: Cadence, plan: BillingPlan) {
  const tier = TIERS[cadence];
  return plan === "yearly" ? tier.yearly : tier.monthly;
}

export function priceLabel(cadence: Cadence, plan: BillingPlan) {
  const amount = priceFor(cadence, plan);
  return plan === "yearly" ? `€${amount}/year` : `€${amount}/month`;
}

export function monthlyEquivalent(cadence: Cadence) {
  return (TIERS[cadence].yearly / 12).toFixed(2);
}
