import { describe, it, expect } from "vitest";
import { parseAIResponse } from "./parse-response";

describe("parseAIResponse", () => {
  it("parses valid JSON directly", () => {
    const result = parseAIResponse('{"message":"Hello","pills":["Next"]}');
    expect(result.message).toBe("Hello");
    expect(result.pills).toEqual(["Next"]);
  });

  it("parses JSON with surrounding whitespace", () => {
    const result = parseAIResponse('  \n {"message":"Hi"} \n ');
    expect(result.message).toBe("Hi");
  });

  it("extracts JSON from markdown code fence", () => {
    const input = 'Some preamble\n```json\n{"message":"From fence","html":"<div>Hi</div>"}\n```\nSome postamble';
    const result = parseAIResponse(input);
    expect(result.message).toBe("From fence");
    expect(result.html).toBe("<div>Hi</div>");
  });

  it("extracts JSON from bare code fence", () => {
    const input = '```\n{"message":"Bare fence"}\n```';
    const result = parseAIResponse(input);
    expect(result.message).toBe("Bare fence");
  });

  it("extracts first JSON object from mixed text", () => {
    const input = 'Here is my response: {"message":"Embedded","pills":["A","B"]} and more text';
    const result = parseAIResponse(input);
    expect(result.message).toBe("Embedded");
    expect(result.pills).toEqual(["A", "B"]);
  });

  it("falls back to raw text as message", () => {
    const result = parseAIResponse("Just plain text response");
    expect(result.message).toBe("Just plain text response");
  });

  it("handles empty input", () => {
    const result = parseAIResponse("");
    expect(result.message).toContain("Sorry");
  });

  it("handles whitespace-only input", () => {
    const result = parseAIResponse("   \n  ");
    expect(result.message).toContain("Sorry");
  });

  it("parses response with HTML content", () => {
    const input = JSON.stringify({
      message: "Here's your site",
      html: "<!DOCTYPE html><html><body>Hello</body></html>",
      pills: ["Love it", "Change colors"],
    });
    const result = parseAIResponse(input);
    expect(result.message).toBe("Here's your site");
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.pills).toHaveLength(2);
  });

  it("parses response with plan", () => {
    const input = JSON.stringify({
      message: "Here's my plan",
      plan: { summary: "A modern site", sections: ["Hero", "About"], style: "minimal" },
    });
    const result = parseAIResponse(input);
    expect(result.plan?.summary).toBe("A modern site");
    expect(result.plan?.sections).toHaveLength(2);
  });
});
