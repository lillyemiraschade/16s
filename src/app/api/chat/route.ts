import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

// Image type for typed uploads
const UploadedImageSchema = z.object({
  data: z.string(), // base64 data URL
  url: z.string().optional(), // Vercel Blob URL for direct embedding
  type: z.enum(["inspo", "content"]),
  label: z.string().optional(),
});

// Request validation with defaults for resilience
const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().default(() => `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    role: z.enum(["user", "assistant"]),
    content: z.string().max(50000).default(""),
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
INSPO IMAGES = MANDATORY PIXEL-PERFECT CLONING
═══════════════════════════════════════════════════════════════════

⚠️ THESE STEPS ARE MANDATORY. DO NOT SKIP ANY STEP.
⚠️ FAILURE TO MATCH INSPO = FAILED OUTPUT. REDO UNTIL IT MATCHES.

MANDATORY STEP 1 — LAYOUT STRUCTURE:
You MUST identify and EXACTLY replicate:
- Text alignment: LEFT, CENTER, or RIGHT? (DO NOT DEFAULT TO CENTER)
- Column structure: 1-column OR 2-column asymmetric (60/40, 70/30)?
- Element positions: Where is text? Where are visuals? Any overlaps?
- If inspo has LEFT-aligned text with visual on RIGHT → build it EXACTLY that way

MANDATORY STEP 2 — TYPOGRAPHY:
You MUST match:
- Font weight: thin (100-300), regular (400), medium (500), bold (600+)
- Style: italic or normal?
- Letter-spacing: tight, normal, or wide?
- If inspo has THIN ITALIC text → use font-weight: 300; font-style: italic;
- DO NOT use bold text if inspo uses thin text

MANDATORY STEP 3 — COLORS:
You MUST extract and use:
- Exact background color(s) or gradient
- Text colors for each hierarchy level
- Accent colors
- Glow/shadow colors with correct opacity

MANDATORY STEP 4 — VISUAL EFFECTS:
You MUST recreate ALL visual effects visible in inspo:
- Gradient glows → use box-shadow with large blur + radial-gradient
- Starfield/particles → use CSS pseudo-elements or background-image
- Waves/landscapes → use SVG paths or clip-path
- 3D depth → layer multiple gradients with different opacities
- DO NOT SKIP effects because they seem "decorative"

MANDATORY STEP 5 — NAVIGATION:
You MUST match:
- Position and alignment of nav items
- All links that appear in inspo nav
- Visual style (transparent, solid, etc.)

CSS REFERENCE — USE THESE TECHNIQUES:

/* Glowing portal/arch effect */
.portal {
  background: linear-gradient(to top, #8B5CF6, #C084FC);
  border-radius: 100px 100px 0 0;
  box-shadow: 0 0 100px 50px rgba(139, 92, 246, 0.3),
              0 0 200px 100px rgba(139, 92, 246, 0.15);
}

/* Starfield background - generate many random positions */
.stars::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 10% 20%, white, transparent),
    radial-gradient(1px 1px at 30% 50%, white, transparent),
    radial-gradient(2px 2px at 50% 10%, white, transparent),
    radial-gradient(1px 1px at 70% 80%, white, transparent),
    radial-gradient(1px 1px at 90% 30%, white, transparent);
  background-size: 250px 250px;
  animation: twinkle 4s ease-in-out infinite;
}

/* Purple gradient atmosphere/glow */
.atmosphere {
  background: radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.4) 0%, transparent 60%);
}

/* Wave/landscape SVG */
.wave { clip-path: url(#wave-path); /* or use inline SVG */ }

⚠️ CRITICAL RULE: If inspo has text on the LEFT, DO NOT center it.
The spatial arrangement is the MOST recognizable aspect of any design.
Getting layout wrong = completely wrong output.

IMAGE TYPES — CRITICAL:
- INSPO images (website screenshots) → clone the STYLE only, don't embed the image itself
- CONTENT images (logo, team photos, product photos) → embed in the HTML using URLs or placeholders

HOW TO EMBED CONTENT IMAGES:
When user uploads content images, you can SEE thumbnails of them. Each image comes with either:
1. A direct URL (preferred) - use it exactly as provided: <img src="https://..." alt="Description" />
2. A placeholder format - use {{CONTENT_IMAGE_N}}: <img src="{{CONTENT_IMAGE_0}}" alt="Description" />

IMPORTANT: If a URL is provided, use the EXACT URL. Do not modify it.
Place images in appropriate sections (logo in nav, team photos on about, products on products page, etc.)

BACKGROUND REMOVAL:
Users can remove backgrounds from images using the sparkle button on uploaded images. If a user uploads a photo that would look better as a PNG cutout (headshots, product photos, logos with backgrounds), suggest they use the "Remove background" button before you build. PNG cutouts on solid/gradient backgrounds look more professional than rectangular photos.

═══════════════════════════════════════════════════════════════════
NO INSPO PROVIDED? USE THESE DEFAULTS
═══════════════════════════════════════════════════════════════════

ONLY APPLY THESE RULES WHEN USER HAS NOT PROVIDED INSPIRATION IMAGES.
If user provides inspo → CLONE IT EXACTLY, ignore these defaults.

MANDATORY DESIGN RULES (no inspo only):
1. SOLID backgrounds ONLY — #FFFFFF, #FAFAFA, #F5F5F5, #0A0A0A, #111111
   Avoid gradients and glows unless they match a specific brand
2. ONE accent color from business context:
   - Finance → deep blue (#1E3A5F) or forest green (#2D5A3D)
   - Creative → coral (#E85D4C), mustard (#D4A03C), or teal (#2A7B7B)
   - Tech → electric blue (#0066FF), lime (#84CC16), or orange (#F97316)
   - Health → sage green (#7C9A7E), soft blue (#6B9AC4)
   - Food → warm terracotta (#C4785B), olive (#6B7B3A)
3. LEFT-ALIGNED hero text with asymmetric layout (60/40 or 70/30)
4. Giant typography: 72-120px headlines, 500-600 weight, tight letter-spacing (-0.02em)
5. Sharp corners on buttons (border-radius: 0-8px) — NOT pills unless brand-appropriate
6. Minimal color palette: background + text + ONE accent

AVOID (when no inspo):
- Purple gradients + centered text combo (generic AI look)
- "Book a Call", "Get Started", "Learn More" (too generic)
- Thin font weights (300, light) — use 400+ minimum
- Identical repeating cards — vary sizes and layouts

BUTTON STYLE (default):
- Background: accent color or black
- Text: white or contrast color
- Padding: 16px 32px
- Border-radius: 0-8px
- Font-weight: 500 or 600
- SPECIFIC CTA text: "See the work", "Start your project", "View pricing"

HERO LAYOUT (default):
- 2-column: 60% text left, 40% image/visual right
- OR full-width with text left-aligned, max-width 600px
- Headline → short description (1-2 lines) → CTA button

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
⚠️ MANDATORY QUALITY CHECK — VERIFY BEFORE OUTPUTTING
═══════════════════════════════════════════════════════════════════

IF INSPO PROVIDED — ALL MUST BE TRUE OR REDO:
□ LAYOUT: Text alignment MATCHES inspo exactly? (left/center/right)
□ LAYOUT: Column structure MATCHES? (centered vs asymmetric)
□ TYPOGRAPHY: Font weight MATCHES? (thin 300 vs bold 600+)
□ TYPOGRAPHY: Style MATCHES? (italic vs normal)
□ EFFECTS: ALL visual effects recreated? (glows, stars, waves, gradients)
□ NAV: Navigation position and style MATCHES?
□ COLORS: Using same color palette as inspo?
⚠️ If ANY item fails → DO NOT OUTPUT → fix and re-verify

IF NO INSPO — ALL MUST BE TRUE:
□ NOT using generic AI look (purple gradients + centered hero)?
□ Using business-appropriate accent color (not default purple)?
□ Hero has asymmetric or left-aligned layout?
□ Buttons have specific CTA text (not "Get Started")?
□ Typography has clear hierarchy with appropriate weights?

ALWAYS — MANDATORY FOR ALL:
□ Would a top design agency approve this?
□ All nav links and buttons functional?
□ Mobile layout clean (no horizontal overflow)?
□ Sufficient whitespace (80px+ section padding)?`;

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

    // DEBUG: Log the raw request
    console.log("[Chat API] Raw request keys:", Object.keys(raw));
    console.log("[Chat API] Messages count:", raw.messages?.length ?? "NO MESSAGES");
    if (raw.messages?.[0]) {
      console.log("[Chat API] First message:", JSON.stringify(raw.messages[0]).slice(0, 200));
    }

    // Pre-sanitize messages to fix common issues before validation
    if (raw.messages && Array.isArray(raw.messages)) {
      raw.messages = raw.messages
        .filter((m: Record<string, unknown>) => m && typeof m === "object" && m.role)
        .map((m: Record<string, unknown>, i: number) => ({
          ...m,
          id: m.id || `msg-${Date.now()}-${i}`,
          content: typeof m.content === "string" && m.content ? m.content : "[No content]",
        }));
      console.log("[Chat API] After sanitize, messages count:", raw.messages.length);
    }

    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const errorDetail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid format";
      console.error("[Chat API] Validation FAILED:", JSON.stringify(parsed.error.issues, null, 2));
      console.error("[Chat API] Raw messages were:", JSON.stringify(raw.messages)?.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Invalid request: ${errorDetail}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { messages, uploadedImages, inspoImages, currentPreview, previewScreenshot } = parsed.data;

    // Normalize images: combine new typed format with legacy format
    type UploadedImage = { data: string; url?: string; type: "inspo" | "content"; label?: string };
    const allImages: UploadedImage[] = [
      ...(uploadedImages || []),
      ...(inspoImages || []).map((img) => ({ data: img, type: "inspo" as const })),
    ];

    const claudeMessages: MessageParam[] = [];

    // Track global content image index across all messages
    let globalContentImageIndex = 0;

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

          // Add content images - use URLs directly if available, otherwise fallback to placeholders
          if (contentImgs.length > 0) {
            // Check if images have blob URLs
            const hasUrls = contentImgs.some(img => img.url);

            if (hasUrls) {
              contentBlocks.push({
                type: "text",
                text: `[CONTENT IMAGES - Use the provided URLs directly in your HTML img src attributes:]`,
              });
            } else {
              contentBlocks.push({
                type: "text",
                text: `[CONTENT IMAGES - Use placeholders in your HTML. The system will replace them with actual images:]`,
              });
            }

            for (let i = 0; i < contentImgs.length; i++) {
              const img = contentImgs[i];
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
                // Tell Claude to use URL directly if available, otherwise use placeholder
                if (img.url) {
                  contentBlocks.push({
                    type: "text",
                    text: `[Content image #${globalContentImageIndex}${labelNote} → Use this URL: ${img.url}]`,
                  });
                } else {
                  contentBlocks.push({
                    type: "text",
                    text: `[Content image #${globalContentImageIndex}${labelNote} → Use placeholder: {{CONTENT_IMAGE_${globalContentImageIndex}}}]`,
                  });
                }
                globalContentImageIndex++;
              }
            }
          }

          // Build the system note based on what types of images we have
          let systemNote = "";
          const hasUrls = contentImgs.some(img => img.url);
          if (inspoImgs.length > 0 && contentImgs.length > 0) {
            if (hasUrls) {
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images (use the provided URLs directly in img src). For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the exact URLs provided above.]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images (use placeholders like {{CONTENT_IMAGE_0}}). For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the {{CONTENT_IMAGE_N}} placeholders in img src attributes.]";
            }
          } else if (inspoImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: These are INSPIRATION images. CLONE THE DESIGN PIXEL-PERFECTLY. Extract exact colors, typography, spacing, layout, button styles, nav style — everything. DO NOT interpret. CLONE EXACTLY what you see.]";
          } else if (contentImgs.length > 0) {
            if (hasUrls) {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images. Use the exact URLs provided above directly in img src attributes. Do NOT modify the URLs.]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images. Use {{CONTENT_IMAGE_N}} placeholders in img src attributes. The system will replace them with actual image data.]";
            }
          }

          const userText = msg.content || "Here are my images.";
          contentBlocks.push({
            type: "text",
            text: userText + systemNote,
          });

          claudeMessages.push({ role: "user", content: contentBlocks });
        } else {
          claudeMessages.push({ role: "user", content: msg.content || "[No content]" });
        }
      } else {
        claudeMessages.push({ role: "assistant", content: msg.content || "..." });
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
