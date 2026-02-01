import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    pills?: string[];
    showUpload?: boolean;
  }>;
  inspoImages: string[];
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
Always respond with valid JSON (no markdown code blocks, just raw JSON):
{
  "message": "Your conversational message to the user",
  "pills": ["Option A", "Option B"],
  "showUpload": true,
  "html": "<!DOCTYPE html>..."
}

Only include pills when offering choices. Only include showUpload when asking for inspo. Only include html when generating or updating a website.

WHEN GENERATING HTML - THIS IS CRITICAL:
- Generate a COMPLETE, FULLY FLESHED OUT website - NOT just a homepage
- Build ALL pages into a single HTML document using JavaScript-based client-side routing
- Include navigation that works between pages (Home, About, Services/Menu/Products, Contact, etc.)
- Every page must have FULL, REAL content - not placeholders or "coming soon"
- Each section should have multiple paragraphs, real-feeling details, realistic pricing, hours, team bios, etc.
- Use Google Fonts (Satoshi, Manrope, Cabinet Grotesk, Instrument Sans, Space Grotesk - NOT Inter/Roboto/Arial)
- Large confident headlines (48-96px)
- Perfect typography hierarchy (letter-spacing -0.02em on display, line-height 1.1-1.2 headlines, 1.6 body)
- 8px spacing grid (8, 16, 24, 32, 48, 64, 80, 96, 120px)
- Section padding 80-120px vertical
- Container max-width 1200-1400px
- Subtle entrance animations (fade + translateY 20px, using IntersectionObserver)
- Hover transitions 150ms ease-out
- Real-feeling placeholder content (NOT lorem ipsum) - write actual compelling copy
- High-quality images from picsum.photos (use different seed numbers for variety)
- WCAG AA contrast ratios
- Responsive with media queries
- Smooth scroll behavior
- NO purple-to-blue gradients, NO generic startup aesthetic, NO AI slop
- If inspo was provided, match that aesthetic with high fidelity - same colors, typography feel, spacing rhythm, border radius patterns

PAGE ROUTING PATTERN (use this in every generated site):
Use a simple JS router where clicking nav links shows/hides page sections. Each "page" is a <section> with display:none by default, and the router shows the active one. Include a showPage() function and wire up all nav links. Make sure the initial page is "home".

WHEN UPDATING HTML (iteration):
- Take the current HTML and modify it based on user request
- Return the COMPLETE updated HTML document
- Keep all existing content and pages unless user asks to change them
- Maintain the routing system

VIBE OPTIONS to offer:
- "Clean & minimal"
- "Warm & friendly"
- "Bold & modern"
- "Premium & sophisticated"`;

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, inspoImages, currentPreview } = body;

    const claudeMessages: MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        const isLastUserMessage = messages.indexOf(msg) === messages.length - 1;

        if (isLastUserMessage && inspoImages && inspoImages.length > 0) {
          const contentBlocks: (ImageBlockParam | TextBlockParam)[] = [];

          for (const img of inspoImages) {
            const matches = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
            if (matches) {
              contentBlocks.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: matches[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: matches[2],
                },
              });
            }
          }

          contentBlocks.push({
            type: "text",
            text: msg.content || "Here are my inspiration images. Please design based on these.",
          });

          claudeMessages.push({ role: "user", content: contentBlocks });
        } else {
          claudeMessages.push({ role: "user", content: msg.content });
        }
      } else {
        claudeMessages.push({ role: "assistant", content: msg.content });
      }
    }

    // Inject current preview context for iteration
    if (currentPreview && claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      if (lastMessage.role === "user" && typeof lastMessage.content === "string") {
        lastMessage.content = `[The user currently has a website preview. Here is the current HTML (truncated):\n${currentPreview.substring(0, 6000)}\n]\n\nUser request: ${lastMessage.content}`;
      }
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const responseText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    let parsedResponse: ChatResponse;
    try {
      // Try direct parse first
      parsedResponse = JSON.parse(responseText.trim());
    } catch {
      try {
        // Try extracting from code blocks
        const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try finding JSON object in the text
          const objMatch = responseText.match(/\{[\s\S]*\}/);
          if (objMatch) {
            parsedResponse = JSON.parse(objMatch[0]);
          } else {
            parsedResponse = { message: responseText || "Let me try that again..." };
          }
        }
      } catch {
        parsedResponse = { message: responseText || "Let me try that again..." };
      }
    }

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : "";
    console.error("Chat API error:", errMsg, errStack);

    const isCredits = errMsg.includes("credit balance");
    return new Response(
      JSON.stringify({
        message: isCredits
          ? "Looks like the AI service needs its credits topped up. The team is on it!"
          : "Give me one more second...",
        _debug: errMsg,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
