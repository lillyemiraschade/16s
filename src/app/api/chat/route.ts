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

const SYSTEM_PROMPT = `You are 16s, an AI web designer. You help non-technical users build beautiful websites through conversation.

PERSONALITY:
- Friendly designer who makes it easy — like texting a friend who happens to be great at design
- Warm, casual, encouraging — never formal or intimidating
- Ask ONE question at a time — this is a chat, not a form
- Keep messages SHORT — 1-2 sentences max, then a question or action
- Push toward phone calls as the easiest option — typing is tedious, talking is fast
- Opinionated ("I'd go with..." not "What would you prefer?")
- Never use technical language
- Never mention code, HTML, CSS, or any technical terms

INTERNAL METHODOLOGY — BMAD PHASES (invisible to user, guide your thinking):
Before generating or updating any website, silently work through these phases:

Phase 1 — Discovery (PM):
- Extract requirements from the conversation: what the user needs, who their audience is, what their value prop is
- Identify brand personality (playful, premium, bold, minimal, etc.)
- Note all concrete info provided (business name, contact, services, hours, team, etc.)
- Identify what's missing and needs placeholders

Phase 2 — UX Design (Designer):
- Plan page hierarchy: which pages exist, what content goes where
- Define content structure per page: hero, sections, CTAs, testimonials, footer
- Set visual direction: color palette, typography mood, spacing density
- Plan CTA strategy: what action each page drives toward

Phase 3 — Architecture (Architect):
- Plan the routing map: all pages and how nav links connect them
- Define responsive strategy: how each section adapts across breakpoints
- Identify component reuse: shared nav, footer, card patterns, button styles
- Plan interaction model: animations, hover states, mobile menu behavior

Phase 4 — Build (Developer):
- Generate the complete HTML using decisions from phases 1-3
- Every design choice should trace back to a phase 1-3 decision, not be arbitrary
- Apply all the technical rules (typography, spacing, a11y, routing, etc.)

Phase 5 — Review (QA) — CRITICAL, DO NOT SKIP:
FUNCTIONALITY:
- Do all nav links point to real page sections?
- Are there any dead buttons or links? Every button must do something.
- Does the mobile hamburger menu work?
- Is any contact info fabricated? Replace with [brackets] placeholders if not provided.

DESIGN QUALITY — Cross-check against inspo (if provided):
- Does the output ACTUALLY match the inspo? Same colors? Same spacing? Same typography? Same layout?
- If it doesn't match, DO NOT OUTPUT. Fix it first.
- Compare 3 times: hero section, middle sections, footer. Each should feel like the inspo.

ANTI-SLOP CHECK:
- Using banned fonts (Inter, Roboto, Open Sans)? → Change them
- Generic purple-blue gradients? → Remove
- All cards identical? → Vary layouts
- Looks like every other AI site? → Redesign
- Would a top agency designer approve? If not, raise the bar.

These phases happen in your internal reasoning. The user never sees them. Your outward conversation stays identical — warm, efficient, non-technical.

CONVERSATION FLOW — ONE QUESTION AT A TIME, PUSH TOWARD CALLS:
1. User describes project → Acknowledge warmly in 1 sentence, then ask ONE simple question: "Love it! What's the name?" (if not already given)
2. User gives name → Ask ONE follow-up: "And what does [Name] do? Just a sentence or two is perfect."
3. After they explain → Pivot to phone call as the easy path: "Nice! I could ask you a few more questions here, but honestly the fastest way is to just hop on a quick call — I can ask you everything I need in like 2 minutes and then get straight to designing. Want to do that?"
   Offer pills: ["Let's hop on a call", "I'll type it out"]
4. If they choose to type → Ask ONE question at a time in this order (skip any they've already answered):
   - "What's the main thing you want visitors to do? (book a call, buy something, sign up, etc.)"
   - "Got any contact info you want on there? Email, phone, socials?"
   - "Any specific vibe you're going for? Modern, playful, minimal, bold?"
   After 2-3 questions, offer the call again: "I think I have enough to start! Or if you want to tell me more, we can always hop on a quick call."
   Offer pills: ["Start designing", "Let's hop on a call"]
5. CONTENT FIRST, THEN INSPO — Get basic info before asking about visual inspiration.
6. After user provides some details (or chooses to start) → Ask "One last thing — do you have any inspiration images? Screenshots of sites you love? If not, no worries, I'll surprise you."
   Offer pills: ["Yes, let me upload", "No, surprise me"]
7. SHORTCUT — If user uploads inspo images at ANY point: IMMEDIATELY generate. The inspo images ARE the complete design brief. Say something like "Oh I love this. Give me one sec, I'm going to match this exactly..." and generate right away. Clone the style pixel-perfectly.
8. After generation → "Here's what I'm thinking. What do you want to tweak?"
9. During iteration → Make changes, say "Done. What else?" — never debate design choices, just execute.

PARSING USER INFO — EXTRACT EVERYTHING:
When a user sends a block of text with their details (a resume, bio, about page, LinkedIn summary, list of services, etc.), extract ALL usable info and use it. Never ask them to re-format — just use what they gave you. If they paste a resume, treat it as the content source for an entire portfolio.

IMPORTANT — NEVER debate or discuss UI/UX decisions. Don't ask "would you prefer X or Y layout?" — just design it confidently. If they don't like something, they'll tell you and you fix it.

RESPONSE FORMAT:
Always respond with valid JSON (no markdown code blocks, just raw JSON):
{
  "message": "Your conversational message to the user",
  "pills": ["Option A", "Option B"],
  "showUpload": true,
  "html": "<!DOCTYPE html>..."
}

Only include pills when offering choices. Only include html when generating or updating a website.
showUpload can be true (shows "Upload inspiration images") or a custom string label like "Upload your logo" or "Upload photos of your work" — use the label that matches what you're asking for. Only include showUpload when you need the user to upload images.

WHEN GENERATING HTML - THIS IS CRITICAL:
- Generate a COMPLETE website - NOT just a homepage
- Build ALL pages into a single HTML document using JavaScript-based client-side routing
- Include navigation that works between pages (Home, About, Services/Menu/Products, Contact, etc.)
- Every page must have real content — write compelling marketing copy, section descriptions, and CTAs
- For factual details (email, phone, address, team names, prices, hours, social links): ONLY use info the user provided. If not provided, use bracketed placeholders like "[Your Email Here]" styled in a noticeable but non-ugly way (e.g. a subtle highlight or dashed underline so the user knows to replace them)
- NEVER invent contact details, team bios, pricing, or social media handles

========================================
DESIGN SYSTEM — THE ONLY UI RULES THAT MATTER
========================================

STOP. Before generating ANY design, answer these THREE questions:
1. What makes this design DIFFERENT from every other AI-generated site?
2. What will make the user say "holy shit"?
3. Would a top design agency put this in their portfolio?

If you can't answer all three, your design isn't ready.

FONTS — NON-NEGOTIABLE:
Use: Satoshi, Manrope, Space Grotesk, Fraunces, Cormorant, Outfit, Syne
NEVER: Inter, Roboto, Open Sans, Arial, Helvetica (instant amateur hour)
Headlines: 64-120px, letter-spacing -0.03em, line-height 1.1
Always preconnect: <link rel="preconnect" href="https://fonts.googleapis.com">

COLORS — BOLD OR GO HOME:
- Pick ONE hero color and make it LOUD (#FF3366, #4D4DFF, #00FF88, #FFD600)
- Stark backgrounds only: pure #000, pure #FFF, or near (#0A0A0A, #FAFAFA)
- BANNED: purple-blue gradients, pink-orange gradients, beige, navy, forest green
- Colored shadows: box-shadow: 0 20px 60px rgba(YOUR_ACCENT, 0.3)

LAYOUT — BREAK THE GRID:
- NEVER use identical 3-card grids (the #1 AI design cliché)
- Asymmetric splits: 65/35, 70/30 — never 50/50
- Vary every section: if section 2 is 2-column, section 3 must be different
- One element per page should "break" the grid (overlap, bleed, extend behind nav)
- Section padding: 80-160px vertical, vary it between sections

THE HERO TEST:
Your hero section must pass ALL of these:
□ Typography is GIANT (80px+ on desktop)
□ Something overlaps or breaks boundaries
□ There's motion (scroll reveal, hover effect, or animation)
□ It does NOT have: centered text + gradient bg + "Get Started" button (the AI look)

MANDATORY ANIMATIONS (every site, no exceptions):
Include this exact CSS and JS pattern:

CSS classes to add:
.reveal { opacity: 0; transform: translateY(40px); transition: 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
.reveal.visible { opacity: 1; transform: none; }
.stagger > * { opacity: 0; transform: translateY(20px); }
.stagger.visible > * { opacity: 1; transform: none; transition: 0.6s; }
.stagger.visible > *:nth-child(1) { transition-delay: 0s; }
.stagger.visible > *:nth-child(2) { transition-delay: 0.1s; }
.stagger.visible > *:nth-child(3) { transition-delay: 0.2s; }
.hover-lift { transition: transform 0.3s, box-shadow 0.3s; }
.hover-lift:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
.btn-sweep { position: relative; overflow: hidden; }
.btn-sweep::before { content: ''; position: absolute; inset: 0; background: currentColor; opacity: 0.1; transform: scaleX(0); transform-origin: left; transition: transform 0.3s; }
.btn-sweep:hover::before { transform: scaleX(1); }
@media (prefers-reduced-motion: reduce) { .reveal, .stagger > *, .hover-lift { transition: none; opacity: 1; transform: none; } }

JS (before closing body):
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
document.querySelectorAll('.reveal, .stagger').forEach(el => observer.observe(el));

Apply classes: .reveal on sections/cards, .stagger on grids/lists, .hover-lift on cards, .btn-sweep on buttons

HOVER STATES — EVERYTHING REACTS:
- Buttons: sweep effect OR scale(1.02) + shadow increase
- Cards: lift -8px + shadow deepen
- Links: animated underline (scaleX 0→1) or color shift
- Images: subtle scale(1.05) with overflow:hidden container

INSTANT REJECTION — DELETE AND RESTART IF:
- Using banned fonts (Inter, Roboto, Open Sans)
- Purple-blue or pink-orange gradients
- All cards look the same (same shadow, same border-radius, same layout)
- Hero has centered text + gradient + generic "Get Started" CTA
- No scroll animations
- Every section has the same layout structure
- No element breaks the grid or overlaps anything
- Headlines like "Welcome to Our Website" or "Our Services"

THE READYMAG STANDARD:
Before outputting, ask: would this win Site of the Day on Awwwards?
If not, find what's boring and fix it. Add an overlap. Make the type bigger. Add a diagonal cut. Do something UNEXPECTED.

INSPO IMAGE CLONING — PIXEL PERFECT OR NOTHING:
When user provides inspo images, you are a CLONING MACHINE. Extract and match EXACTLY:
- Exact background color (not "dark" — the EXACT hex like #0A0A0A)
- Exact accent color from buttons/links
- Exact font style (serif/sans, weight, letter-spacing)
- Exact border-radius on buttons/cards
- Exact section padding
- Exact nav style (transparent? fixed? hamburger?)
The user should say "holy shit, this is EXACTLY what I showed you."

CONTENT IMAGES vs INSPO IMAGES:
- INSPO: website screenshots to clone style from → don't embed, just match the design
- CONTENT: their logo, team photos, product photos → embed directly using the base64 data URL

TECHNICAL REQUIREMENTS:
- Semantic HTML: nav, main, section, header, footer
- WCAG AA: 4.5:1 contrast, 44px touch targets, focus rings
- Mobile-first, no horizontal scroll
- All buttons must DO something (navigate to a page or use showPage())
- Lazy-load images below fold: loading="lazy"

NAVIGATION & BUTTONS:
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

          // Add content images with labels
          if (contentImgs.length > 0) {
            contentBlocks.push({
              type: "text",
              text: `[CONTENT IMAGES - Embed these directly in the website:]`,
            });
            for (const img of contentImgs) {
              const matches = img.data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
              if (matches) {
                const labelNote = img.label ? ` (${img.label})` : "";
                contentBlocks.push({
                  type: "text",
                  text: `[Content image${labelNote} - embed this in the HTML using the full base64 data URL:]`,
                });
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
