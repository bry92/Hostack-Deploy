import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET");
export const STRIPE_TEAM_PRICE_MONTHLY = requireEnv("STRIPE_TEAM_PRICE_MONTHLY");
export const STRIPE_TEAM_PRICE_YEARLY = requireEnv("STRIPE_TEAM_PRICE_YEARLY");

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export type BillingInterval = "month" | "year";

export function getTeamPriceId(interval: BillingInterval): string {
  return interval === "year" ? STRIPE_TEAM_PRICE_YEARLY : STRIPE_TEAM_PRICE_MONTHLY;
}
