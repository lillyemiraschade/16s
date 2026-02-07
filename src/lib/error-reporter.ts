/**
 * Structured error reporting utility.
 * In development: logs to console.
 * In production: POSTs to configured endpoint (if any), otherwise console.error.
 * Never throws, never blocks — fire-and-forget.
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    console.error("[16s Error]", error.message, context);
    return;
  }

  console.error("[16s Error]", error.message, context);

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
