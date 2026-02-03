import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const VoiceRequestSchema = z.object({
  voiceMessages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10000),
  })).max(50),
  projectContext: z.string().max(5000).optional(),
});

interface VoiceResponse {
  message: string;
  complete: boolean;
}

const VOICE_SYSTEM_PROMPT = `You are 16s, an AI web designer on a voice call with a client. Your job is to gather ALL the information needed to build their website through natural conversation.

RULES:
- Ask ONE question at a time — this is a phone call, not a form
- Be warm, conversational, casual — like a real designer on a discovery call
- Track what you've gathered and what's still missing
- Cover these topics (but conversationally, not as a checklist):
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
- When you have enough info to start designing, wrap up naturally with something like: "Awesome, I think I've got everything I need to get started. I'll get to work on this right now."

RESPONSE FORMAT: Always respond with raw JSON (no markdown, no code blocks):
{"message": "your spoken response", "complete": false}

Set "complete": true ONLY when you've gathered enough info and are wrapping up the call. This signals the call should end.`;

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = VoiceRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ message: "Invalid request format.", complete: false }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { voiceMessages, projectContext } = parsed.data;

    // Build messages for Claude
    const claudeMessages: MessageParam[] = voiceMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add project context to the first user message if provided
    if (projectContext && claudeMessages.length > 0) {
      const firstUserIdx = claudeMessages.findIndex((m) => m.role === "user");
      if (firstUserIdx >= 0 && typeof claudeMessages[firstUserIdx].content === "string") {
        claudeMessages[firstUserIdx].content =
          `[Context: The user previously mentioned they want to build: ${projectContext}]\n\n${claudeMessages[firstUserIdx].content}`;
      }
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
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
          parsedResponse = { message: fullText || "Could you say that again?", complete: false };
        }
      } else {
        parsedResponse = { message: fullText || "Could you say that again?", complete: false };
      }
    }

    // Ensure response has required fields
    if (!parsedResponse.message) {
      parsedResponse.message = "Could you tell me more?";
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
    return new Response(
      JSON.stringify({ message: "Let me think about that...", complete: false }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
