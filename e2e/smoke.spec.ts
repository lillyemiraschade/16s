import { test, expect } from "@playwright/test";

// Mock streaming NDJSON response matching the real API format
const MOCK_RESPONSE_LINES = [
  JSON.stringify({ type: "token", text: '{"' }),
  JSON.stringify({ type: "token", text: 'message": "' }),
  JSON.stringify({ type: "token", text: "Here is your website!" }),
  JSON.stringify({ type: "token", text: '", "html": "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>"' }),
  JSON.stringify({ type: "token", text: ', "pills": ["Love it", "Make changes"]' }),
  JSON.stringify({ type: "token", text: "}" }),
  JSON.stringify({
    type: "done",
    response: {
      message: "Here is your website!",
      html: "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>",
      pills: ["Love it", "Make changes"],
    },
  }),
].join("\n") + "\n";

function mockChatRoute(page: import("@playwright/test").Page) {
  return page.route("**/api/chat", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: MOCK_RESPONSE_LINES,
    });
  });
}

test.describe("Smoke tests", () => {
  test("homepage loads with welcome screen", async ({ page }) => {
    await page.goto("/");
    // Welcome headline
    await expect(page.locator("h1")).toBeVisible();
    // Input area
    await expect(page.locator("textarea")).toBeVisible();
    // Send button
    await expect(page.locator('button[aria-label="Send message"]')).toBeVisible();
  });

  test("idea pills are visible and clickable", async ({ page }) => {
    await page.goto("/");
    // The marquee renders idea suggestion buttons
    const pills = page.locator("button").filter({ hasText: /.{10,}/ });
    // Wait for at least one idea pill to appear (they load from useWelcome)
    await expect(pills.first()).toBeVisible({ timeout: 10_000 });
  });

  test("send prompt and receive streaming response", async ({ page }) => {
    await mockChatRoute(page);
    await page.goto("/");

    // Type a prompt
    const textarea = page.locator("textarea");
    await textarea.fill("Build me a portfolio site");

    // Send it
    await page.locator('button[aria-label="Send message"]').click();

    // Should transition to chat view — the user message should appear
    await expect(page.getByText("Build me a portfolio site")).toBeVisible({ timeout: 10_000 });

    // The AI response should stream in
    await expect(page.getByText("Here is your website!")).toBeVisible({ timeout: 10_000 });

    // Response pills should appear
    await expect(page.getByText("Love it")).toBeVisible({ timeout: 10_000 });
  });

  test("preview iframe renders HTML from response", async ({ page }) => {
    await mockChatRoute(page);
    await page.goto("/");

    const textarea = page.locator("textarea");
    await textarea.fill("Build me a site");
    await page.locator('button[aria-label="Send message"]').click();

    // Wait for the response to complete
    await expect(page.getByText("Here is your website!")).toBeVisible({ timeout: 10_000 });

    // The preview iframe should exist and have content
    const iframe = page.locator("iframe");
    await expect(iframe).toBeVisible({ timeout: 10_000 });
  });

  test("projects page loads", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("h1", { hasText: "Projects" })).toBeVisible({ timeout: 10_000 });
  });
});
