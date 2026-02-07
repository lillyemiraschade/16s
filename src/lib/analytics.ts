/**
 * Lightweight analytics utility. Fire-and-forget, never blocks UI.
 * In development: console.debug.
 * In production: POST to NEXT_PUBLIC_ANALYTICS_ENDPOINT if configured.
 */

type AnalyticsEvent =
  | { name: "page_view"; props: { page: string } }
  | { name: "message_sent"; props: { hasImages: boolean; mode: "build" | "discussion" } }
  | { name: "generation_complete"; props: { model: string; tokens: number; hasHtml: boolean } }
  | { name: "deploy"; props: { success: boolean } }
  | { name: "voice_call"; props: { duration: number } }
  | { name: "image_upload"; props: { type: "inspo" | "content"; bgRemoved: boolean } }
  | { name: "project_created" | "project_loaded" | "project_deleted"; props?: undefined }
  | { name: "auth_signin" | "auth_signup" | "auth_signout"; props?: undefined }
  | { name: "upgrade_clicked"; props: { from: string } }
  | { name: "feature_used"; props: { feature: string } };

export function track(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[Analytics]", event.name, (event as { props?: unknown }).props);
    return;
  }

  // PostHog (preferred)
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    try {
      const { posthog } = require("@/lib/posthog");
      posthog.capture(event.name, "props" in event ? event.props : {});
    } catch {}
    return;
  }

  // Fallback: custom endpoint
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (endpoint) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, timestamp: Date.now() }),
    }).catch(() => {});
  }
}
