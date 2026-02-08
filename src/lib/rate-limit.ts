// Shared in-memory rate limiter (per IP, configurable limit per window)
// NOTE: In-memory — resets on serverless cold starts. For production at scale,
// consider Redis or Upstash for distributed rate limiting.

export function createRateLimiter(limit: number, windowMs: number = 60_000) {
  const map = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  return {
    check(ip: string): boolean {
      const now = Date.now();

      // Sweep expired entries every windowMs or when map exceeds 100 entries
      if (now - lastSweep > windowMs || map.size > 100) {
        map.forEach((v, k) => {
          if (now > v.resetAt) map.delete(k);
        });
        lastSweep = now;
      }

      const entry = map.get(ip);
      if (!entry || now > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= limit) return false;
      entry.count++;
      return true;
    },
  };
}
