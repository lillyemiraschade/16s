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
    credits: 10,
    projects: 2,
    deployments: 1,
    features: ["10 generations/month", "2 sites", "1 live deployment", "Community support"],
  },
  pro: {
    name: "Pro",
    price: 24,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    credits: 75,
    projects: 25,
    deployments: 10,
    features: ["75 generations/month", "25 sites", "10 live deployments", "Custom domains", "GitHub export", "Form submissions", "Priority support"],
  },
} as const;

export type PlanType = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): PlanType | null {
  if (priceId === PLANS.pro.priceId) return "pro";
  return null;
}
