import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

// Image type for typed uploads
const UploadedImageSchema = z.object({
  data: z.string(), // base64 data URL
  type: z.enum(["inspo", "content"]),
  label: z.string().optional(),
});

// Request validation
const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string().max(50000),
    uploadedImages: z.array(UploadedImageSchema).optional(),
  })).max(200),
  uploadedImages: z.array(UploadedImageSchema).max(10).optional(), // New typed format
  inspoImages: z.array(z.string()).max(10).optional(), // Legacy format for backward compat
  currentPreview: z.string().max(500000).nullable(),
  previewScreenshot: z.string().max(2000000).nullable().optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

interface ChatResponse {
  message: string;
  pills?: string[];
  showUpload?: boolean | string;
  html?: string;
}

// Simple in-memory rate limiter (per IP, 20 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean stale entries periodically
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    rateLimitMap.forEach((val, key) => {
      if (now > val.resetAt) rateLimitMap.delete(key);
    });
  };
  const timer = setInterval(cleanup, RATE_WINDOW_MS);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

const SYSTEM_PROMPT = `You are 16s, an AI web designer. You build beautiful websites through conversation.

═══════════════════════════════════════════════════════════════════
PERSONALITY & CONVERSATION
═══════════════════════════════════════════════════════════════════

Be warm and casual — like texting a designer friend. Ask ONE question at a time. Keep messages to 1-2 sentences. Be opinionated. Never use technical terms.

VOICE CALLS — IMPORTANT:
This app has a built-in voice call feature. When you offer a call, include a pill like "Hop on a call" — clicking it starts an in-app voice conversation with you (the AI). You DO NOT need phone numbers. Never ask for or give phone numbers. Never say "I can't take calls" — you CAN via the in-app feature. The call happens instantly when they click the pill.

FLOW:
1. Get business name → 2. What they do → 3. Offer: "Want to hop on a quick call? I can ask everything in 2 min. Or type it out here."
   Pills: ["Hop on a call", "I'll type it out"]
4. If they call → voice agent handles it → returns summary → you generate
5. If they type → ask CTA goal, contact info, vibe (one at a time) → ask for inspo → generate
6. After generation → "Here's what I'm thinking. What do you want to tweak?"

If user uploads inspo images: IMMEDIATELY generate. Clone the style exactly.
If user pastes text (resume, bio, etc.): Extract all info and use it.
Never debate design choices — just execute.

RESPONSE FORMAT (raw JSON, no markdown):
{"message": "...", "pills": ["A", "B"], "showUpload": true, "html": "<!DOCTYPE html>..."}
Only include fields when needed.

═══════════════════════════════════════════════════════════════════
INSPO IMAGES = CLONE EXACTLY
═══════════════════════════════════════════════════════════════════

When user provides inspo, analyze then replicate:
- COLORS: Extract exact hex (background, text, accent, borders)
- TYPOGRAPHY: Serif or sans? Weight? Letter-spacing? Size ratio?
- LAYOUT: Centered or asymmetric? Max-width? Section padding?
- NAV: Fixed/sticky? Transparent/solid? Logo position?
- BUTTONS: Sharp/rounded/pill? Fill/outline? Hover effect?
- SPECIAL: Overlaps? Shadows? Image treatment?

Build it EXACTLY. If inspo has purple gradients → use purple gradients.
User should say "this is EXACTLY what I showed you."

IMAGE TYPES — CRITICAL:
- INSPO images (website screenshots) → clone the STYLE only, don't embed the image itself
- CONTENT images (logo, team photos, product photos) → EMBED DIRECTLY in the HTML

HOW TO EMBED CONTENT IMAGES:
When user uploads content images, you receive them with base64 data. Use that EXACT data in your HTML:
<img src="data:image/jpeg;base64,/9j/4AAQ..." alt="Description" />
Copy the FULL base64 string from the image data provided. Place the image in the appropriate section (logo in nav, team photos on about page, product photos on products page, etc.)

═══════════════════════════════════════════════════════════════════
NO INSPO? USE THESE DEFAULTS
═══════════════════════════════════════════════════════════════════

5 THINGS TO DO:
1. Solid backgrounds (#FFF or #000) + ONE bold accent color
2. Giant typography (80-150px headlines), max 2 fonts
3. Asymmetric layouts (60/40, 70/30) — break the grid somewhere
4. Generous whitespace (100-160px section padding)
5. Scroll animations + hover states on everything

5 THINGS TO AVOID:
1. Purple gradients + centered text + "Get Started" (the AI look)
2. Inter, Roboto, Open Sans, Lato fonts
3. Identical cards (vary sizes, layouts)
4. Generic copy ("Transform Your Business", "quality services")
5. Stock photos (laptops, handshakes, meeting rooms)

═══════════════════════════════════════════════════════════════════
CSS FOUNDATION (include in every site)
═══════════════════════════════════════════════════════════════════

:root {
  --space-2: 8px; --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px; --space-24: 96px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
  --radius-md: 8px; --radius-lg: 12px;
}
.container { max-width: 1280px; margin-inline: auto; padding-inline: clamp(16px, 5vw, 64px); }

/* Scroll animations */
.reveal { opacity: 0; transform: translateY(30px); transition: 0.6s ease; }
.reveal.visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; } }

/* Interactions */
button, a, .card { transition: all 0.15s ease; }
button:hover { transform: translateY(-2px); }
button:active { transform: scale(0.98); }
.card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }

/* Intersection Observer (before </body>) */
const obs = new IntersectionObserver(e => e.forEach(el => el.isIntersecting && el.target.classList.add('visible')), {threshold: 0.1});
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

═══════════════════════════════════════════════════════════════════
HTML GENERATION RULES
═══════════════════════════════════════════════════════════════════

STRUCTURE:
- Complete multi-page site with JS routing (showPage function)
- Pages: Home, About, Services/Products, Contact minimum
- Fixed nav with working links, mobile hamburger menu
- All buttons must navigate somewhere (showPage or scroll)

CONTENT:
- Write specific, compelling copy for THIS business
- Use [brackets] for missing info: [Your Email], [Your Phone]
- NEVER invent contact details, team names, prices
- NO emojis anywhere

TECHNICAL:
- Semantic HTML (nav, main, section, footer)
- WCAG AA contrast (4.5:1), 44px touch targets
- Mobile-first, no horizontal scroll
- Lazy-load images: loading="lazy"
- Preconnect fonts: <link rel="preconnect" href="https://fonts.googleapis.com">

FONTS (use these):
Satoshi, Manrope, Space Grotesk, Outfit, Syne, Fraunces, Cormorant

═══════════════════════════════════════════════════════════════════
QUALITY CHECK (before outputting)
═══════════════════════════════════════════════════════════════════

□ Does it look different from generic AI sites?
□ Would a design agency put this in their portfolio?
□ Do all nav links and buttons work?
□ Is there scroll animation on sections?
□ Is mobile layout working?
□ If inspo provided: does it ACTUALLY match?`;

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ message: "You\u2019re sending requests too quickly. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    let raw;
    try {
      raw = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Request too large. Try with fewer or smaller images." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const errorDetail = parsed.error.issues[0]?.message || "Invalid format";
      return new Response(
        JSON.stringify({ error: `Invalid request: ${errorDetail}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { messages, uploadedImages, inspoImages, currentPreview, previewScreenshot } = parsed.data;

    // Normalize images: combine new typed format with legacy format
    type UploadedImage = { data: string; type: "inspo" | "content"; label?: string };
    const allImages: UploadedImage[] = [
      ...(uploadedImages || []),
      ...(inspoImages || []).map((img) => ({ data: img, type: "inspo" as const })),
    ];

    const claudeMessages: MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        const isLastUserMessage = messages.indexOf(msg) === messages.length - 1;

        // Get images for this message - either from the message itself or from the request (for last message)
        const messageImages = isLastUserMessage ? allImages : (msg.uploadedImages || []);

        if (messageImages.length > 0) {
          const contentBlocks: (ImageBlockParam | TextBlockParam)[] = [];

          // Separate inspo and content images
          const inspoImgs = messageImages.filter((img) => img.type === "inspo");
          const contentImgs = messageImages.filter((img) => img.type === "content");

          // Add inspo images first with label
          if (inspoImgs.length > 0) {
            contentBlocks.push({
              type: "text",
              text: `[INSPIRATION IMAGES - Clone these designs pixel-perfectly:]`,
            });
            for (const img of inspoImgs) {
              const matches = img.data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
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
          }

          // Add content images with labels - include BOTH visual and the data URL for embedding
          if (contentImgs.length > 0) {
            contentBlocks.push({
              type: "text",
              text: `[CONTENT IMAGES - These images should be embedded directly in the website HTML:]`,
            });
            for (const img of contentImgs) {
              const matches = img.data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
              if (matches) {
                const labelNote = img.label ? ` (${img.label})` : "";
                // Show the image visually so AI can see what it is
                contentBlocks.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: matches[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: matches[2],
                  },
                });
                // ALSO provide the full data URL as text so AI can embed it
                contentBlocks.push({
                  type: "text",
                  text: `[Content image${labelNote} - USE THIS EXACT STRING as the img src:]
${img.data}`,
                });
              }
            }
          }

          // Build the system note based on what types of images we have
          let systemNote = "";
          if (inspoImgs.length > 0 && contentImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images (embed directly in the HTML using <img src=\"data:image/...;base64,...\">). For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the full base64 data URL in the src attribute.]";
          } else if (inspoImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: These are INSPIRATION images. CLONE THE DESIGN PIXEL-PERFECTLY. Extract exact colors, typography, spacing, layout, button styles, nav style — everything. DO NOT interpret. CLONE EXACTLY what you see.]";
          } else if (contentImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images. Embed them directly in the HTML using <img src=\"data:image/...;base64,...\"> tags. Use the full base64 data URL provided. Place them in appropriate sections based on the labels.]";
          }

          const userText = msg.content || "Here are my images.";
          contentBlocks.push({
            type: "text",
            text: userText + systemNote,
          });

          claudeMessages.push({ role: "user", content: contentBlocks });
        } else {
          claudeMessages.push({ role: "user", content: msg.content });
        }
      } else {
        claudeMessages.push({ role: "assistant", content: msg.content });
      }
    }

    // Determine if this is a simple iteration or complex generation
    const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || "";
    const hasImages = allImages.length > 0;
    const isFirstGeneration = !currentPreview;

    // Simple iterations: color changes, text tweaks, small adjustments
    const simplePatterns = [
      /^(change|make|set|update|switch|use)\s+(the\s+)?(color|colour|background|font|text|size|padding|margin|spacing)/i,
      /^(make\s+it|change\s+it\s+to)\s+(bigger|smaller|larger|darker|lighter|bolder)/i,
      /^(add|remove|delete|hide|show)\s+(the\s+)?(button|link|image|section|text|border|shadow)/i,
      /^(move|align|center|left|right)\s+(the\s+)?/i,
      /^(change|update|edit|fix)\s+(the\s+)?(title|heading|subtitle|paragraph|caption|label)/i,
      /\b(color|colour|#[0-9a-f]{3,6}|rgb|hsl)\b/i,
    ];

    const isSimpleIteration = currentPreview &&
      !hasImages &&
      !isFirstGeneration &&
      lastUserMessage.length < 200 &&
      simplePatterns.some(pattern => pattern.test(lastUserMessage));

    // Select model and tokens based on complexity
    const model = isSimpleIteration ? "claude-3-5-haiku-20241022" : "claude-sonnet-4-20250514";
    const maxTokens = isSimpleIteration ? 8000 : 16000;

    // Inject current preview context - use smaller context for simple iterations
    if (currentPreview && claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      const contextLimit = isSimpleIteration ? 15000 : 30000; // Less context for fast iterations
      const previewContext = `[The user currently has a website preview. Here is the current HTML:\n${currentPreview.substring(0, contextLimit)}\n]`;
      if (lastMessage.role === "user") {
        if (typeof lastMessage.content === "string") {
          lastMessage.content = `${previewContext}\n\nUser request: ${lastMessage.content}`;
        } else if (Array.isArray(lastMessage.content)) {
          const lastTextIndex = lastMessage.content.findLastIndex(
            (block) => block.type === "text"
          );
          if (lastTextIndex >= 0) {
            const textBlock = lastMessage.content[lastTextIndex] as TextBlockParam;
            textBlock.text = `${previewContext}\n\nUser request: ${textBlock.text}`;
          }
        }
      }
    }

    // Inject screenshot only for complex generations (Sonnet) - skip for simple iterations
    if (!isSimpleIteration && previewScreenshot && claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      const screenshotMatch = previewScreenshot.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (screenshotMatch) {
        const screenshotImage: ImageBlockParam = {
          type: "image",
          source: {
            type: "base64",
            media_type: screenshotMatch[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: screenshotMatch[2],
          },
        };
        const screenshotNote: TextBlockParam = {
          type: "text",
          text: "[VISUAL CONTEXT: This is a screenshot of the website the user currently sees. Use it to verify visual quality and catch rendering issues.]",
        };

        if (typeof lastMessage.content === "string") {
          lastMessage.content = [
            screenshotImage,
            screenshotNote,
            { type: "text" as const, text: lastMessage.content },
          ];
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content = [screenshotImage, screenshotNote, ...lastMessage.content];
        }
      }
    }

    // Use streaming to avoid Vercel function timeout
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
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

    // Provide more specific error messages
    let userMessage = "Something went wrong. Please try again.";
    if (errMsg.includes("body") || errMsg.includes("size") || errMsg.includes("large")) {
      userMessage = "Request too large. Try with fewer or smaller images.";
    } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
      userMessage = "Request timed out. Please try again.";
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
