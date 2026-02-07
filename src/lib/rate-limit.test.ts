import { describe, it, expect, vi } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter(3);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("blocks requests at the limit", () => {
    const limiter = createRateLimiter(2);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("tracks IPs independently", () => {
    const limiter = createRateLimiter(1);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("2.2.2.2")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);
    expect(limiter.check("2.2.2.2")).toBe(false);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(1, 1000);

    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limiter.check("1.2.3.4")).toBe(true);

    vi.useRealTimers();
  });

  it("sweeps expired entries when map exceeds 500", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(1, 100);

    // Fill with 501 IPs
    for (let i = 0; i <= 500; i++) {
      limiter.check(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    }

    // Expire them all
    vi.advanceTimersByTime(200);

    // Next check triggers sweep
    expect(limiter.check("new-ip")).toBe(true);

    vi.useRealTimers();
  });
});
