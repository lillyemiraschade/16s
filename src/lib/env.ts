// Typed environment variable access with validation.
// Required vars throw at import time if missing (fast fail on cold start).
// Optional vars return undefined gracefully.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

// Core — app won't function without these
export const env = {
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),

  // Payments (optional — app works without Stripe, just no paid features)
  stripeSecretKey: optionalEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: optionalEnv("STRIPE_WEBHOOK_SECRET"),
  stripeProPriceId: optionalEnv("STRIPE_PRO_PRICE_ID"),
  stripeTeamPriceId: optionalEnv("STRIPE_TEAM_PRICE_ID"),

  // Supabase admin (only needed for webhook route)
  supabaseServiceRoleKey: optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // Deploy (optional — deploy feature disabled without these)
  vercelToken: optionalEnv("VERCEL_TOKEN"),
  vercelTeamId: optionalEnv("VERCEL_TEAM_ID"),

  // Image features (optional — features gracefully degrade)
  blobReadWriteToken: optionalEnv("BLOB_READ_WRITE_TOKEN"),
  removeBgApiKey: optionalEnv("REMOVE_BG_API_KEY"),
} as const;
