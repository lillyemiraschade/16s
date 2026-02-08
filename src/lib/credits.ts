import { createClient } from "@/lib/supabase/server";

/**
 * Check and deduct credits for an authenticated user.
 * Uses optimistic concurrency control to prevent double-spending.
 * Fail-open: allows request if credit check fails (don't block users on errors).
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
      .select("credits_remaining")
      .eq("user_id", userId)
      .single();

    if (fetchError || !subscription) {
      console.debug("[Credits] No subscription found, creating default...");
      try {
        const { data: created, error: insertError } = await supabase
          .from("subscriptions")
          .upsert({
            user_id: userId,
            plan: "free",
            status: "active",
            credits_remaining: 50,
          }, { onConflict: "user_id" })
          .select("credits_remaining")
          .single();

        if (insertError || !created) {
          console.debug("[Credits] Failed to create subscription:", insertError);
          return { success: true }; // still fail-open on error
        }

        if (created.credits_remaining < creditsToDeduct) {
          return { success: false, remaining: created.credits_remaining, error: "insufficient_credits" };
        }

        return checkAndDeductCredits(userId, creditsToDeduct, action, retryCount);
      } catch {
        return { success: true }; // fail-open
      }
    }

    if (subscription.credits_remaining < creditsToDeduct) {
      return { success: false, remaining: subscription.credits_remaining, error: "insufficient_credits" };
    }

    // Deduct with optimistic concurrency control
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({ credits_remaining: subscription.credits_remaining - creditsToDeduct })
      .eq("user_id", userId)
      .eq("credits_remaining", subscription.credits_remaining)
      .select("credits_remaining");

    if (updateError) {
      console.debug("[Credits] Failed to deduct credits:", updateError);
      return { success: true, remaining: subscription.credits_remaining };
    }

    // Concurrent modification — retry once
    if (!updated || updated.length === 0) {
      if (retryCount < 1) {
        console.debug("[Credits] Concurrent modification detected, retrying...");
        return checkAndDeductCredits(userId, creditsToDeduct, action, retryCount + 1);
      }
      console.debug("[Credits] Concurrent modification persisted after retry, allowing request");
      return { success: true };
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
    console.debug("[Credits] Error checking credits:", err);
    return { success: true };
  }
}
