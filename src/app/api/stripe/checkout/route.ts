import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PLANS, PlanType } from "@/lib/stripe/config";
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

    const { plan } = await request.json() as { plan: PlanType };

    if (plan !== "pro") {
      return apiError("Invalid plan", 400);
    }

    const planConfig = PLANS[plan];
    if (!planConfig.priceId) {
      return apiError("Price not configured", 500);
    }

    // Check if user already has a Stripe customer ID
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    const stripeClient = getStripe();
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Get the origin for redirect URLs
    const origin = request.headers.get("origin") || (process.env.NEXT_PUBLIC_APP_URL || "https://try16s.app");

    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
    });

    return apiSuccess({ url: session.url });
  } catch (error) {
    console.error("[Checkout] Error:", error);
    return apiError("Unable to connect to payment provider. Please try again.", 500);
  }
}
