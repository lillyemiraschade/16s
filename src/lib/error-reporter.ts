/**
 * Structured error reporting utility.
 * Priority: Sentry (if DSN configured) → custom endpoint → console.error.
 * Never throws, never blocks — fire-and-forget.
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    console.error("[16s Error]", error.message, context);
    return;
  }

  console.error("[16s Error]", error.message, context);

  // Sentry (preferred in production)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      const Sentry = require("@sentry/nextjs");
      Sentry.captureException(error, { extra: context });
    } catch {}
    return;
  }

  // Fallback: custom endpoint
  const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
  if (endpoint) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now(),
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    }).catch(() => {});
  }
}
