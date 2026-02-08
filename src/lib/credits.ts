import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/config";

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Check and deduct credits for an authenticated user.
 * Auto-resets credits when the billing period expires (covers free + paid users).
 * Uses optimistic concurrency control to prevent double-spending.
 * Fail-closed: denies request if credit check fails to prevent abuse.
 */
export async function checkAndDeductCredits(
  userId: string,
  creditsToDeduct: number = 1,
  action: string = "chat_message",
  retryCount: number = 0
): Promise<{ success: boolean; remaining?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("credits_remaining, plan, current_period_end")
      .eq("user_id", userId)
      .single();

    if (fetchError || !subscription) {
      console.debug("[Credits] No subscription found, creating default...");
      const freePlan = PLANS.free;
      try {
        const { data: created, error: insertError } = await supabase
          .from("subscriptions")
          .upsert({
            user_id: userId,
            plan: "free",
            status: "active",
            credits_remaining: freePlan.credits,
            current_period_end: new Date(Date.now() + PERIOD_MS).toISOString(),
          }, { onConflict: "user_id" })
          .select("credits_remaining")
          .single();

        if (insertError || !created) {
          console.error("[Credits] Failed to create subscription:", insertError);
          return { success: false, error: "credit_check_failed" };
        }

        if (created.credits_remaining < creditsToDeduct) {
          return { success: false, remaining: created.credits_remaining, error: "insufficient_credits" };
        }

        return checkAndDeductCredits(userId, creditsToDeduct, action, retryCount);
      } catch (err) {
        console.error("[Credits] Subscription creation error:", err);
        return { success: false, error: "credit_check_failed" };
      }
    }

    // Auto-reset credits if the billing period has expired
    let creditsRemaining = subscription.credits_remaining;
    const now = Date.now();

    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end).getTime();
      if (now >= periodEnd) {
        const planConfig = PLANS[subscription.plan as keyof typeof PLANS] || PLANS.free;
        creditsRemaining = planConfig.credits;
        const newPeriodEnd = new Date(now + PERIOD_MS).toISOString();

        console.debug(`[Credits] Period expired for user ${userId}, resetting to ${creditsRemaining} credits`);

        const { error: resetError } = await supabase
          .from("subscriptions")
          .update({
            credits_remaining: creditsRemaining,
            current_period_end: newPeriodEnd,
          })
          .eq("user_id", userId)
          .eq("current_period_end", subscription.current_period_end);

        if (resetError) {
          console.error("[Credits] Failed to reset credits:", resetError);
        }
      }
    } else {
      // Legacy row with no period end — backfill it
      await supabase
        .from("subscriptions")
        .update({ current_period_end: new Date(now + PERIOD_MS).toISOString() })
        .eq("user_id", userId);
    }

    if (creditsRemaining < creditsToDeduct) {
      return { success: false, remaining: creditsRemaining, error: "insufficient_credits" };
    }

    // Deduct with optimistic concurrency control
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({ credits_remaining: creditsRemaining - creditsToDeduct })
      .eq("user_id", userId)
      .eq("credits_remaining", creditsRemaining)
      .select("credits_remaining");

    if (updateError) {
      console.error("[Credits] Failed to deduct credits:", updateError);
      return { success: false, error: "credit_check_failed" };
    }

    // Concurrent modification — retry once
    if (!updated || updated.length === 0) {
      if (retryCount < 1) {
        console.debug("[Credits] Concurrent modification detected, retrying...");
        return checkAndDeductCredits(userId, creditsToDeduct, action, retryCount + 1);
      }
      console.error("[Credits] Concurrent modification persisted after retry, denying request");
      return { success: false, error: "credit_check_failed" };
    }

    // Log usage (non-blocking)
    Promise.resolve(
      supabase.from("usage").insert({
        user_id: userId,
        action,
        credits_used: creditsToDeduct,
        metadata: { timestamp: new Date().toISOString() },
      })
    ).then(({ error }) => {
      if (error) console.debug("[Credits] Failed to log usage:", error);
    }).catch(() => {});

    return { success: true, remaining: updated[0].credits_remaining };
  } catch (err) {
    console.error("[Credits] Error checking credits:", err);
    return { success: false, error: "credit_check_failed" };
  }
}
