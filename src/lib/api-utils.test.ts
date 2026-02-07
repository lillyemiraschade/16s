import { describe, it, expect } from "vitest";
import { apiError, apiSuccess } from "./api-utils";

describe("apiError", () => {
  it("returns a Response with error JSON and status", async () => {
    const res = apiError("Not found", 404);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("sets Content-Type to application/json", () => {
    const res = apiError("Bad", 400);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("merges additional headers", () => {
    const res = apiError("Rate limited", 429, { "Retry-After": "60" });
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});

describe("apiSuccess", () => {
  it("returns a 200 Response with JSON data", async () => {
    const res = apiSuccess({ result: "ok" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.result).toBe("ok");
  });

  it("supports custom status code", async () => {
    const res = apiSuccess({ created: true }, 201);
    expect(res.status).toBe(201);
  });

  it("sets Content-Type to application/json", () => {
    const res = apiSuccess({});
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});
