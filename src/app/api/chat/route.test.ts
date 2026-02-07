import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Anthropic SDK
const mockStream = {
  async *[Symbol.asyncIterator]() {
    yield { type: "content_block_delta", delta: { type: "text_delta", text: '{"message":"Hello' } };
    yield { type: "content_block_delta", delta: { type: "text_delta", text: '","pills":["Next"]}' } };
  },
};

vi.mock("@/lib/ai/anthropic", () => ({
  anthropic: {
    messages: {
      stream: vi.fn(() => mockStream),
    },
  },
}));

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null } })) },
  })),
}));

// Mock env
vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

import { POST } from "./route";

async function readNDJSON(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text.trim().split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with streaming NDJSON for valid request", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Build me a landing page" }],
        currentPreview: null,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const events = await readNDJSON(response);
    expect(events.length).toBeGreaterThanOrEqual(2);

    // Should have token events and a done event
    const tokens = events.filter((e: any) => e.type === "token");
    const done = events.find((e: any) => e.type === "done");
    expect(tokens.length).toBeGreaterThan(0);
    expect(done).toBeDefined();
    expect((done as any).response.message).toBe("Hello");
  });

  it("returns 400 for invalid request body", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: "not-an-array" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Invalid request");
  });

  it("returns 429 when rate limited", async () => {
    const requests = [];
    for (let i = 0; i < 22; i++) {
      requests.push(
        new Request("http://localhost:3000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.0.0.99",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Hello" }],
            currentPreview: null,
          }),
        })
      );
    }

    let rateLimited = false;
    for (const req of requests) {
      const response = await POST(req);
      if (response.status === 429) {
        rateLimited = true;
        const body = await response.json();
        expect(body.message).toContain("too quickly");
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });

  it("returns 400 for message exceeding length limit", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "a".repeat(11000) }],
        currentPreview: null,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("too long");
  });
});
