/** Plans and their limits. The database enforces the same limits (see PLAN_LIMIT_* in the migrations). */
export type PlanId = "free" | "pro" | "business";

export const PLANS: Record<
  PlanId,
  {
    name: string;
    pricePerSeat: number;
    tagline: string;
    limits: { projects: number | null; members: number | null; aiCredits: number };
    features: string[];
  }
> = {
  free: {
    name: "Free",
    pricePerSeat: 0,
    tagline: "For small teams getting organized.",
    limits: { projects: 3, members: 5, aiCredits: 20 },
    features: [
      "3 active projects",
      "Up to 5 members",
      "Every view, sprints and automations",
      "20 AI credits a month",
    ],
  },
  pro: {
    name: "Pro",
    pricePerSeat: 8,
    tagline: "For product teams that ship every week.",
    limits: { projects: null, members: 25, aiCredits: 200 },
    features: [
      "Everything in Free",
      "Unlimited projects",
      "Up to 25 members",
      "200 AI credits a month",
    ],
  },
  business: {
    name: "Business",
    pricePerSeat: 16,
    tagline: "For larger teams that need control.",
    limits: { projects: null, members: null, aiCredits: 1_000_000 },
    features: [
      "Everything in Pro",
      "Unlimited members",
      "Unlimited AI credits",
      "Priority support",
    ],
  },
};

export const isPaid = (plan: PlanId) => plan !== "free";
export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

export type BillingInterval = "month" | "year";
/** Paying yearly costs ten months: two months free. */
export const YEARLY_MONTHS = 10;

/** Price of one seat for a whole billing period, in dollars. */
export function seatPrice(plan: PlanId, interval: BillingInterval) {
  const monthly = PLANS[plan].pricePerSeat;
  return interval === "year" ? monthly * YEARLY_MONTHS : monthly;
}

/** What one seat works out to per month, in cents (yearly prices are shown this way). */
export function monthlyEquivalentCents(plan: PlanId, interval: BillingInterval) {
  return Math.round((seatPrice(plan, interval) * 100) / (interval === "year" ? 12 : 1));
}
