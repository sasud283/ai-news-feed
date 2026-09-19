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
    firstSend: "Your first digest arrives this Friday at 07:00 CET.",
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
    firstSend: "Your first briefing arrives tomorrow morning at 07:00 CET.",
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

/**
 * Buttondown hosts the paid-subscription checkout and hands billing to Stripe.
 * Each tier/plan combination has its own Buttondown checkout URL, supplied via
 * env. When it isn't configured yet we fall back to the in-app confirmation.
 */
export function buttondownCheckoutUrl(cadence: Cadence, plan: BillingPlan, email: string) {
  const env = import.meta.env as Record<string, string | undefined>;
  const key = `VITE_BUTTONDOWN_CHECKOUT_${cadence.toUpperCase()}_${plan.toUpperCase()}`;
  const base = env[key];
  if (!base) return null;
  const url = new URL(base);
  if (email) url.searchParams.set("email", email);
  return url.toString();
}
