import type { ChatAPIResponse } from "@/lib/types";

/**
 * Parse AI text output into a structured ChatAPIResponse.
 * Tries direct JSON parse first, then fallback strategies for
 * malformed or wrapped responses.
 */
export function parseAIResponse(text: string): ChatAPIResponse {
  const trimmed = text.trim();
  if (!trimmed) {
    return { message: "Sorry, I couldn't process that. Could you try rephrasing?" };
  }

  // Strategy 1: Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to fallbacks
  }

  // Strategy 2: Extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Strategy 3: Extract first JSON object
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // continue
    }
  }

  // Strategy 4: Return raw text as message
  return { message: trimmed };
}
