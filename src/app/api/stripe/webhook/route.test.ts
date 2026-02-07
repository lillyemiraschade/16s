import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe/config", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
  getPlanByPriceId: (id: string) => (id === "price_pro" ? "pro" : null),
  PLANS: {
    free: { credits: 50 },
    pro: { credits: 500 },
    team: { credits: 2000 },
  },
}));

// Mock Supabase admin client
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) });
const mockSelect = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate, select: mockSelect });
let adminClientAvailable = true;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => (adminClientAvailable ? { from: mockFrom } : null),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({
    get: (name: string) => (name === "stripe-signature" ? "sig_test" : null),
  }),
}));

// Set env vars
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": "sig_test" },
  });
}

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminClientAvailable = true;
  });

  it("handles checkout.session.completed — updates subscription", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { supabase_user_id: "user-1", plan: "pro" },
          subscription: "sub_123",
        },
      },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    expect(mockFrom).toHaveBeenCalledWith("subscriptions");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "pro",
        status: "active",
        stripe_subscription_id: "sub_123",
        credits_remaining: 500,
      })
    );
  });

  it("returns 400 for invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("returns 500 when admin client unavailable", async () => {
    adminClientAvailable = false;
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Database not configured");
  });
});
