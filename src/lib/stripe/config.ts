import Stripe from "stripe";

// Lazy initialization to avoid build-time errors when env vars are missing
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(key, {
      // API version is pinned to match the installed stripe package types
      // When upgrading stripe package, update this version accordingly
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backwards compatibility
export const stripe = {
  get customers() { return getStripe().customers; },
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
} as const;

// Pricing tiers
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    credits: 50,
    projects: 3,
    deployments: 1,
    features: ["50 AI generations/month", "3 projects", "1 deployment", "Basic support"],
  },
  pro: {
    name: "Pro",
    price: 20,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    credits: 500,
    projects: -1, // unlimited
    deployments: 10,
    features: ["500 AI generations/month", "Unlimited projects", "10 deployments", "Custom domains", "Priority support"],
  },
  team: {
    name: "Team",
    price: 50,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    credits: 2000,
    projects: -1,
    deployments: -1,
    features: ["2000 AI generations/month", "Unlimited projects", "Unlimited deployments", "Team collaboration", "Analytics", "Dedicated support"],
  },
} as const;

export type PlanType = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): PlanType | null {
  if (priceId === PLANS.pro.priceId) return "pro";
  if (priceId === PLANS.team.priceId) return "team";
  return null;
}
