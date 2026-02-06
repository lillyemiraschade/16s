import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// [2026-02-05] Rate limiting — voice uses expensive Sonnet model, prevent abuse
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // 30 req/min (voice needs fast back-and-forth but still needs limits)
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateLimitMap.size > 500) {
      rateLimitMap.forEach((v, k) => { if (now > v.resetAt) rateLimitMap.delete(k); });
    }
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const VoiceRequestSchema = z.object({
  voiceMessages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10000),
    source: z.enum(["voice", "typed"]).optional(),
  })).max(50),
  projectContext: z.string().max(5000).optional(),
  hasTypedInput: z.boolean().optional(), // Flag when user typed something in chat during the call
});

interface VoiceResponse {
  message: string;
  complete: boolean;
}

const VOICE_SYSTEM_PROMPT = `You are 16s, an AI web designer on a voice call with a client. Your job is to gather ALL the information needed to build their website through natural conversation.

INTERNAL STATE TRACKING — CRITICAL FOR LONGER CALLS:
At each turn, mentally note what you've gathered so far:
- Name: [gathered or not]
- What they do: [gathered or not]
- Target audience: [gathered or not]
- Pages needed: [gathered or not]
- Services/products/content: [gathered or not]
- Contact info: [gathered or not]
- Social links: [gathered or not]
- Style/vibe: [gathered or not]

This helps you remember what's been covered and what to ask next, especially in longer conversations.

RULES:
- Ask ONE question at a time — this is a phone call, not a form
- Be warm, conversational, casual — like a real designer on a discovery call
- REMEMBER what they've already told you — don't re-ask questions
- NEVER make up or assume information the user hasn't explicitly told you
- If you didn't hear or understand something, ASK for clarification — don't guess
- If the call ends abruptly or you have minimal info, acknowledge that honestly
- Cover these topics (conversationally, not as a checklist):
  • Business/project name
  • What they do (services, products, or purpose)
  • Target audience (who is this site for?)
  • Pages needed (home, about, services, contact, etc.)
  • Content details (services list, menu items, products, pricing if applicable)
  • Contact info (email, phone, address)
  • Social media links
  • Brand vibe/style preferences (modern, minimal, bold, warm, etc.)
- When they don't have something or want to skip, acknowledge it and move on
- Keep responses SHORT — this is voice, not text. 1-2 sentences max.
- NEVER discuss HTML, code, or technical implementation details
- NEVER generate any website code
- If you feel like you're going in circles, summarize what you have and move to wrap-up

TYPED INPUTS FROM CHAT:
- Sometimes users will TYPE information in the chat while on the call (like emails, links, etc.)
- When you see a message marked as [TYPED IN CHAT], acknowledge it naturally: "Perfect, I see you put that in the chat, got it!"
- Continue the conversation naturally after acknowledging

ENDING THE CALL — BE HONEST ABOUT WHAT YOU GATHERED:
- After gathering 4-5 key pieces of info, start wrapping up
- Before wrapping up, ALWAYS ask about inspiration images: "One last thing — do you have any screenshots or images of websites you love? You can drop those in after we hang up and I'll match that style exactly."
- Only say you have "everything you need" if you ACTUALLY gathered substantial information
- If the call was short or you only got basic info, be honest: "I got the basics — I may follow up with a few questions in the chat."
- NEVER claim to have information you didn't receive

RESPONSE FORMAT: Always respond with raw JSON (no markdown, no code blocks):
{"message": "your spoken response", "complete": false}

Set "complete": true ONLY when you've gathered enough info AND asked about inspo images. This signals the call should end.`;

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ message: "Too many requests. Please wait a moment.", complete: false }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const raw = await req.json();
    const parsed = VoiceRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ message: "Invalid request format.", complete: false }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { voiceMessages, projectContext, hasTypedInput } = parsed.data;

    // Build messages for Claude, marking typed inputs
    const claudeMessages: MessageParam[] = voiceMessages.map((msg) => {
      let content = msg.content;
      // Mark typed inputs so the voice agent knows to acknowledge them
      if (msg.role === "user" && msg.source === "typed") {
        content = `[TYPED IN CHAT]: ${msg.content}`;
      }
      return { role: msg.role, content };
    });

    // Add project context to the first user message if provided
    if (projectContext && claudeMessages.length > 0) {
      const firstUserIdx = claudeMessages.findIndex((m) => m.role === "user");
      if (firstUserIdx >= 0 && typeof claudeMessages[firstUserIdx].content === "string") {
        claudeMessages[firstUserIdx].content =
          `[Context: The user previously mentioned they want to build: ${projectContext}]\n\n${claudeMessages[firstUserIdx].content}`;
      }
    }

    // For longer conversations (10+ messages), add a summary hint to help the model track state
    if (claudeMessages.length > 10) {
      // Extract user messages to create a summary context
      const userMessages = voiceMessages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" | ");

      // Prepend a context summary to the last user message
      const lastIdx = claudeMessages.length - 1;
      if (claudeMessages[lastIdx].role === "user" && typeof claudeMessages[lastIdx].content === "string") {
        claudeMessages[lastIdx].content =
          `[CONVERSATION SUMMARY - Info gathered so far: ${userMessages.slice(0, 500)}...]\n\nLatest message: ${claudeMessages[lastIdx].content}`;
      }
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800, // Increased from 500 for longer conversations
      system: VOICE_SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const fullText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse response
    let parsedResponse: VoiceResponse;
    try {
      parsedResponse = JSON.parse(fullText.trim());
    } catch {
      // Try to extract JSON from response
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch {
          // Use the raw text if it exists, otherwise admit we didn't get a response
          parsedResponse = {
            message: fullText.trim() || "I didn't catch that. Could you repeat?",
            complete: false
          };
        }
      } else {
        parsedResponse = {
          message: fullText.trim() || "I didn't catch that. Could you repeat?",
          complete: false
        };
      }
    }

    // Ensure response has required fields - be honest if message is missing
    if (!parsedResponse.message || parsedResponse.message.trim() === "") {
      console.warn("[Voice API] Empty message in response");
      parsedResponse.message = "I didn't catch that. What were you saying?";
    }
    if (typeof parsedResponse.complete !== "boolean") {
      parsedResponse.complete = false;
    }

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Voice API error:", error);
    // Be honest about the error - don't claim to be "thinking"
    return new Response(
      JSON.stringify({ message: "Sorry, I had trouble with that. Could you try again?", complete: false }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
