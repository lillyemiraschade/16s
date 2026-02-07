// Shared in-memory rate limiter (per IP, configurable limit per window)
// NOTE: In-memory — resets on serverless cold starts. For production at scale,
// consider Redis or Upstash for distributed rate limiting.

export function createRateLimiter(limit: number, windowMs: number = 60_000) {
  const map = new Map<string, { count: number; resetAt: number }>();

  return {
    check(ip: string): boolean {
      const now = Date.now();
      const entry = map.get(ip);
      if (!entry || now > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + windowMs });
        // Sweep expired entries when map gets large
        if (map.size > 500) {
          map.forEach((v, k) => {
            if (now > v.resetAt) map.delete(k);
          });
        }
        return true;
      }
      if (entry.count >= limit) return false;
      entry.count++;
      return true;
    },
  };
}
