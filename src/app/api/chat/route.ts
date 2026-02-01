import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export const runtime = "nodejs";

interface ChatRequest {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    pills?: string[];
    showUpload?: boolean;
  }>;
  inspoImage: string | null;
  currentPreview: string | null;
}

interface ChatResponse {
  message: string;
  pills?: string[];
  showUpload?: boolean;
  html?: string;
}

const SYSTEM_PROMPT = `You are 16s, an AI web designer. You help non-technical users build beautiful websites through conversation.

PERSONALITY:
- Senior designer who asks the right questions
- Warm but efficient
- Opinionated ("I'd suggest..." not "What would you like?")
- Never ask more than 2 questions at a time
- Never use technical language
- Never mention code, HTML, CSS, or any technical terms

CONVERSATION FLOW:
1. User describes project → Acknowledge in 1 sentence, ask ONE clarifying question about audience or purpose
2. User answers → Short acknowledgment, then offer vibe options as pills
3. User picks vibe → Ask for inspo screenshots or offer to start designing
4. User provides inspo or skips → Say "Give me a moment..." then generate the website
5. After generation → "Here's what I'm thinking. What do you want to tweak?"
6. During iteration → Make changes, say "Done. What else?"

RESPONSE FORMAT:
Always respond with valid JSON:
{
  "message": "Your conversational message to the user",
  "pills": ["Option A", "Option B", "Option C", "Option D"], // optional, only when offering choices
  "showUpload": true, // optional, only when asking for inspo screenshots
  "html": "<!DOCTYPE html>..." // optional, only when generating/updating the preview
}

WHEN GENERATING HTML:
- Generate a COMPLETE HTML document with inline CSS
- Use Google Fonts (Satoshi, Manrope, Cabinet Grotesk, Instrument Sans, Space Grotesk - NOT Inter/Roboto/Arial)
- Large confident headlines (48-96px)
- Perfect typography hierarchy (letter-spacing -0.02em on display, line-height 1.1-1.2 headlines, 1.6 body)
- 8px spacing grid (8, 16, 24, 32, 48, 64, 80, 96, 120px)
- Section padding 80-120px vertical
- Container max-width 1200-1400px
- Subtle entrance animations (fade + translateY 20px)
- Hover transitions 150ms ease-out
- Real-feeling placeholder content (NOT lorem ipsum)
- High-quality images from picsum.photos
- WCAG AA contrast ratios
- Responsive with media queries
- NO purple-to-blue gradients, NO generic startup aesthetic
- If inspo was provided, match that aesthetic closely

WHEN UPDATING HTML (iteration):
- Take the current HTML and modify it based on user request
- Return the full updated HTML
- Keep all existing content unless user asks to change it

VIBE OPTIONS to offer:
- "Clean & minimal"
- "Warm & friendly"
- "Bold & modern"
- "Premium & sophisticated"`;

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, inspoImage, currentPreview } = body;

    // Build messages for Claude
    const claudeMessages: MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        // If this is the message with inspo image, include it
        const isLastUserMessage = messages.indexOf(msg) === messages.length - 1;

        if (isLastUserMessage && inspoImage) {
          // Extract base64 data and media type
          const matches = inspoImage.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          if (matches) {
            const mediaType = matches[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
            const base64Data = matches[2];

            claudeMessages.push({
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: msg.content,
                },
              ],
            });
          } else {
            claudeMessages.push({
              role: "user",
              content: msg.content,
            });
          }
        } else {
          claudeMessages.push({
            role: "user",
            content: msg.content,
          });
        }
      } else {
        // Assistant message - only include the text content
        claudeMessages.push({
          role: "assistant",
          content: msg.content,
        });
      }
    }

    // Add context about current preview if iterating
    if (currentPreview && claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      if (lastMessage.role === "user" && typeof lastMessage.content === "string") {
        lastMessage.content = `Current website HTML:\n\`\`\`html\n${currentPreview.substring(0, 2000)}...\n\`\`\`\n\nUser request: ${lastMessage.content}`;
      }
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    // Extract the response text
    const responseText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    // Try to parse JSON from the response
    let parsedResponse: ChatResponse;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/) ||
                       responseText.match(/```\n([\s\S]+?)\n```/) ||
                       [null, responseText];

      const jsonText = jsonMatch[1] || responseText;
      parsedResponse = JSON.parse(jsonText.trim());
    } catch (parseError) {
      // If parsing fails, try to extract just the message
      console.error("Failed to parse JSON:", parseError);

      // Fallback: treat the entire response as a message
      parsedResponse = {
        message: responseText || "Give me one more second...",
      };
    }

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat API error:", errMsg);

    const isCredits = errMsg.includes("credit balance");
    return new Response(
      JSON.stringify({
        message: isCredits
          ? "Looks like the AI service needs its credits topped up. The team is on it!"
          : "Give me one more second...",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
