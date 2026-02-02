import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const runtime = "nodejs";
export const maxDuration = 120;

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
3. User picks vibe → Ask "Do you have any inspiration images you'd like me to match?" and offer pills ["Yes, let me upload", "No, just start designing"]
4a. If user says yes → Show upload zone, wait for them to upload and send, then say "Give me a moment..." and generate
4b. If user says no/skips → Say "Give me a moment..." then generate the website
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
- The output must look like a real, professionally designed and hand-coded website — NOT like something an AI generated
- Avoid generic layouts, cookie-cutter hero sections, or samey card grids. Design with intention and specificity for the brand
- Every design decision must feel deliberate: color choices should have reasoning, whitespace should feel composed not random

INSPO IMAGE CLONING - EXTREMELY IMPORTANT:
When the user provides inspiration images, your job is to CLONE that design as closely as possible:
- Extract the EXACT color palette from the inspo (background colors, text colors, accent colors, button colors)
- Match the typography style precisely (serif vs sans-serif, weight, size ratios, letter-spacing)
- Replicate the layout structure (grid patterns, section ordering, whitespace ratios, alignment)
- Copy the border-radius patterns (sharp corners vs rounded vs pill-shaped)
- Match the image treatment (full-bleed vs contained, overlapping vs grid, rounded vs sharp)
- Replicate the navigation style (sticky vs static, transparent vs solid, hamburger vs full)
- Match button styles (outline vs filled, rounded vs sharp, size, hover states)
- Copy the spacing rhythm and density (tight/compact vs airy/spacious)
- Match the overall mood: dark/light, warm/cool, minimal/maximal
- If the inspo has a specific visual element (diagonal sections, overlapping images, gradient overlays), replicate it
- The result should look like it was designed by the same designer who made the inspo

PAGE ROUTING PATTERN (use this in every generated site):
Use a simple JS router where clicking nav links shows/hides page sections. Each "page" is a <section> with display:none by default, and the router shows the active one. Include a showPage() function and wire up all nav links. Make sure the initial page is "home".

CRITICAL - NAVIGATION WITHIN THE SITE:
- The navigation bar must be ALWAYS visible (fixed or sticky at top) on every page
- Every nav link must work and show the correct page
- Include a visible logo/brand name in the nav that ALWAYS links back to home
- When a user clicks "About", "Services", "Contact" etc., that page shows and the nav highlights the active page
- Clicking the logo or "Home" must ALWAYS return to the home page
- The nav should have clear visual feedback for the currently active page (underline, bold, color change)
- On mobile, use a hamburger menu that works
- Add smooth scroll-to-top when switching pages

WHEN UPDATING HTML (iteration):
- Take the current HTML and modify it based on user request
- Return the COMPLETE updated HTML document
- Keep all existing content and pages unless user asks to change them
- Maintain the routing system and navigation

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
            const matches = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
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
        lastMessage.content = `[The user currently has a website preview. Here is the current HTML:\n${currentPreview.substring(0, 30000)}\n]\n\nUser request: ${lastMessage.content}`;
      }
    }

    // Use streaming to avoid Vercel function timeout
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullText += event.delta.text;
              // Send keepalive chunks so Vercel doesn't kill the connection
              controller.enqueue(encoder.encode(" "));
            }
          }

          // Parse the complete response
          let parsedResponse: ChatResponse;
          try {
            parsedResponse = JSON.parse(fullText.trim());
          } catch {
            try {
              const jsonMatch = fullText.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
              if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[1].trim());
              } else {
                const objMatch = fullText.match(/\{[\s\S]*\}/);
                if (objMatch) {
                  parsedResponse = JSON.parse(objMatch[0]);
                } else {
                  parsedResponse = { message: fullText || "Let me try that again..." };
                }
              }
            } catch {
              parsedResponse = { message: fullText || "Let me try that again..." };
            }
          }

          // Send the final JSON
          controller.enqueue(encoder.encode("\n" + JSON.stringify(parsedResponse)));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("Stream error:", errMsg);
          const isCredits = errMsg.includes("credit balance");
          controller.enqueue(
            encoder.encode(
              "\n" +
                JSON.stringify({
                  message: isCredits
                    ? "Looks like the AI service needs its credits topped up. The team is on it!"
                    : "Give me one more second...",
                })
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat API error:", errMsg);

    return new Response(
      JSON.stringify({
        message: "Give me one more second...",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
