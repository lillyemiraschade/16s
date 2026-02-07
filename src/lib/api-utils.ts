// Standardized API response helpers for consistent error/success patterns.

export function apiError(message: string, status: number, headers?: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }
  );
}

export function apiSuccess<T>(data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
