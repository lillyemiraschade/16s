import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/config";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-utils";

const limiter = createRateLimiter(5);

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return apiError("Too many requests", 429);
  }

  try {
    const supabase = await createClient();
    if (!supabase) {
      return apiError("Server not configured", 500);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Unauthorized", 401);
    }

    // Get customer ID
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return apiError("No billing account found", 400);
    }

    const origin = request.headers.get("origin") || (process.env.NEXT_PUBLIC_APP_URL || "https://try16s.app");

    // Create portal session
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing`,
    });

    return apiSuccess({ url: session.url });
  } catch (error) {
    console.error("[Portal] Error:", error);
    return apiError("Unable to connect to payment provider. Please try again.", 500);
  }
}
