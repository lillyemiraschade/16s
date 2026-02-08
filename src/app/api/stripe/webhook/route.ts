import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, getPlanByPriceId, PLANS } from "@/lib/stripe/config";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Use service role for webhook (bypasses RLS)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    console.error("Supabase admin client not configured");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan as "pro";

        if (userId && plan) {
          const planConfig = PLANS[plan];
          await supabase
            .from("subscriptions")
            .update({
              plan,
              status: "active",
              stripe_subscription_id: session.subscription as string,
              credits_remaining: planConfig.credits,
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID, including current plan and credits
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id, plan, credits_remaining")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          const priceId = subscription.items.data[0]?.price.id;
          const newPlan = getPlanByPriceId(priceId || "") || "free";
          const newPlanConfig = PLANS[newPlan];
          const oldPlanConfig = PLANS[sub.plan as keyof typeof PLANS] || PLANS.free;

          // Get current_period_end from the subscription
          const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

          // Smart credit adjustment for mid-cycle changes:
          // - Upgrade: add the difference so unused credits aren't lost
          // - Downgrade: cap at new plan's max credits
          // - Same plan: don't change credits (status update only)
          let credits = sub.credits_remaining;
          if (newPlan !== sub.plan) {
            if (newPlanConfig.credits > oldPlanConfig.credits) {
              // Upgrading — add the credit difference
              credits = sub.credits_remaining + (newPlanConfig.credits - oldPlanConfig.credits);
            } else {
              // Downgrading — cap at new plan's max
              credits = Math.min(sub.credits_remaining, newPlanConfig.credits);
            }
          }

          await supabase
            .from("subscriptions")
            .update({
              plan: newPlan,
              status: subscription.status === "active" ? "active" : "canceled",
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              credits_remaining: credits,
            })
            .eq("user_id", sub.user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          // Downgrade to free
          await supabase
            .from("subscriptions")
            .update({
              plan: "free",
              status: "canceled",
              stripe_subscription_id: null,
              credits_remaining: PLANS.free.credits,
            })
            .eq("user_id", sub.user_id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Reset credits on successful payment (subscription renewal)
        if (invoice.billing_reason === "subscription_cycle") {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("user_id, plan")
            .eq("stripe_customer_id", customerId)
            .single();

          if (sub) {
            const planConfig = PLANS[sub.plan as keyof typeof PLANS];
            await supabase
              .from("subscriptions")
              .update({
                credits_remaining: planConfig.credits,
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })
              .eq("user_id", sub.user_id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("user_id", sub.user_id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
