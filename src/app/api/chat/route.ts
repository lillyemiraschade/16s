import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for Pro plans

// Image type for typed uploads
const UploadedImageSchema = z.object({
  data: z.string(), // base64 data URL
  url: z.string().optional(), // Vercel Blob URL for direct embedding
  type: z.enum(["inspo", "content"]),
  label: z.string().optional(),
});

// Project context schema (learned preferences - invisible to user)
const ProjectContextSchema = z.object({
  brandName: z.string().optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  stylePreferences: z.array(z.string()).optional(),
  colorPreferences: z.array(z.string()).optional(),
  fontPreferences: z.array(z.string()).optional(),
  featuresRequested: z.array(z.string()).optional(),
  thingsToAvoid: z.array(z.string()).optional(),
  lastUpdated: z.number().optional(),
}).optional();

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
  outputFormat: z.enum(["html", "react"]).default("html"), // Output format: vanilla HTML or React components
  context: ProjectContextSchema.nullable().default(null), // Learned preferences (invisible memory)
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

interface ChatResponse {
  message: string;
  pills?: string[];
  showUpload?: boolean | string;
  html?: string;
  react?: string; // React component code when outputFormat is "react"
  // BMAD Planning phase
  plan?: {
    summary: string;
    sections: string[];
    style: string;
  };
  // BMAD QA Report (shown after generation)
  qaReport?: {
    status: "all_good" | "minor_notes" | "needs_fixes";
    checks: Array<{ name: string; passed: boolean; note?: string }>;
    summary: string;
  };
  // Learned preferences (invisible memory, persisted across sessions)
  context?: {
    brandName?: string;
    industry?: string;
    targetAudience?: string;
    stylePreferences?: string[];
    colorPreferences?: string[];
    fontPreferences?: string[];
    featuresRequested?: string[];
    thingsToAvoid?: string[];
  };
}

// Simple in-memory rate limiter (per IP, 20 requests per minute)
// NOTE: This is in-memory and resets on each serverless cold start.
// For production at scale, consider Redis or Upstash for distributed rate limiting.
// Current approach works for moderate traffic where occasional resets are acceptable.
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

// Map API/stream errors to user-friendly messages with HTTP status codes
function getUserFriendlyError(errMsg: string): { message: string; statusCode: number } {
  if (errMsg.includes("body") || errMsg.includes("size") || errMsg.includes("large"))
    return { message: "Request too large. Try with fewer or smaller images.", statusCode: 413 };
  if (errMsg.includes("credit balance") || errMsg.includes("insufficient"))
    return { message: "The AI service is temporarily unavailable. Please try again shortly.", statusCode: 402 };
  if (errMsg.includes("overloaded") || errMsg.includes("529"))
    return { message: "The AI is busy right now. Give me a moment and try again.", statusCode: 503 };
  if (errMsg.includes("rate") || errMsg.includes("429"))
    return { message: "Too many requests. Please wait a few seconds and try again.", statusCode: 429 };
  if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT"))
    return { message: "The request timed out. Please try again.", statusCode: 504 };
  if (errMsg.includes("invalid") || errMsg.includes("400"))
    return { message: "I had trouble understanding that. Could you rephrase your request?", statusCode: 400 };
  if (errMsg.includes("Supabase") || errMsg.includes("not configured"))
    return { message: "Service configuration error. Please try again.", statusCode: 500 };
  return { message: "Let me try that again...", statusCode: 500 };
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

// Credit management for authenticated users
// [2026-02-05] Fixed TOCTOU race condition: uses optimistic concurrency control to prevent double-spending
async function checkAndDeductCredits(userId: string, creditsToDeduct: number = 1, retryCount: number = 0): Promise<{ success: boolean; remaining?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("credits_remaining")
      .eq("user_id", userId)
      .single();

    if (fetchError || !subscription) {
      // No subscription found - allow request but don't track (free tier behavior)
      console.debug("[Credits] No subscription found for user, allowing request");
      return { success: true };
    }

    if (subscription.credits_remaining < creditsToDeduct) {
      return { success: false, remaining: subscription.credits_remaining, error: "Insufficient credits" };
    }

    // Deduct credits with optimistic concurrency control:
    // Only update if credits_remaining still matches what we read (prevents double-spending)
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({ credits_remaining: subscription.credits_remaining - creditsToDeduct })
      .eq("user_id", userId)
      .eq("credits_remaining", subscription.credits_remaining)
      .select("credits_remaining");

    if (updateError) {
      console.error("[Credits] Failed to deduct credits:", updateError);
      // Still allow request if deduction fails - don't block users
      return { success: true, remaining: subscription.credits_remaining };
    }

    // If no rows were updated, another request modified credits concurrently — retry once
    if (!updated || updated.length === 0) {
      if (retryCount < 1) {
        console.debug("[Credits] Concurrent modification detected, retrying...");
        return checkAndDeductCredits(userId, creditsToDeduct, retryCount + 1);
      }
      // After retry, allow the request but log the issue
      console.warn("[Credits] Concurrent modification persisted after retry, allowing request");
      return { success: true };
    }

    // Log usage (non-blocking — don't await to avoid slowing the response)
    supabase.from("usage").insert({
      user_id: userId,
      action: "chat_message",
      credits_used: creditsToDeduct,
      metadata: { timestamp: new Date().toISOString() },
    }).then(({ error }) => {
      if (error) console.error("[Credits] Failed to log usage:", error);
    });

    return { success: true, remaining: updated[0].credits_remaining };
  } catch (err) {
    console.error("[Credits] Error checking credits:", err);
    // Allow request on error - don't block users due to credit check failures
    return { success: true };
  }
}

const SYSTEM_PROMPT = `You are 16s, an AI web designer. You build beautiful websites through conversation.

---
BMAD SYSTEM — PLAN, BUILD, VERIFY (User sees simplified version)
---

You follow the BMAD method internally, but show users SIMPLE, FRIENDLY summaries.

---
PHASE 1: PLANNING (For NEW projects or MAJOR features)
---

When user requests a NEW site/app (not small tweaks), mentally assess: type, audience, goal, sections, style. Then output a SIMPLE PLAN:
{
  "message": "Here's what I'm thinking:",
  "plan": {
    "summary": "A modern recipe app with vintage diner vibes",
    "sections": ["Ingredient input", "Recipe suggestions", "Save favorites"],
    "style": "Retro restaurant menu aesthetic with warm colors"
  },
  "pills": ["Looks good, build it!", "Let's adjust"]
}

IMPORTANT: The "plan" field is a SIMPLE, NON-TECHNICAL summary. No jargon.
- summary: One sentence describing the vibe
- sections: 3-5 main parts (simple names, not technical)
- style: One sentence about the look/feel

Wait for user to say "Looks good" or "build it" before generating HTML.
If they want adjustments, discuss and update the plan.

---
PHASE 2: BUILDING — Generate HTML after plan approval. Skip plan for small tweaks ("make the button blue").
---
PHASE 3: QUALITY CHECK (ALWAYS after generating HTML)
---

After EVERY HTML generation, examine the screenshot you received and run these checks:

VISUAL + IMAGE VERIFICATION:
You receive a screenshot of the current preview. STUDY IT before responding. Check: layout, spacing, alignment, contrast, text readability, style match, any visual glitches.
🔴 If user uploaded images: Can you ACTUALLY SEE them in the screenshot? Empty space = image not showing. Fix with: <img src="URL" alt="desc" style="width:100%;max-width:400px;height:auto;display:block;">
Common causes: missing width/height, overflow:hidden, opacity:0, z-index, position:absolute, display:none. NEVER claim "image is fixed" unless you SEE it.

QA CHECKLIST (check ALL, report honestly):
□ Buttons/links have hover states □ Form labels on every input □ Touch targets >= 44px □ Images have width+height (CLS) □ External links: target="_blank" rel="noopener" □ Mobile: no horizontal scroll □ No leftover [PLACEHOLDER] text □ Good contrast □ All uploaded images visible in screenshot
□ LAYOUT DIVERSITY: Does this use the banned AI layout (hero+3cards+CTA)? Are section structures varied? Mixed column counts? Varied section padding? If layout is generic → FIX before outputting.
If you find issues, FIX THEM in your HTML before outputting. Do NOT rubber-stamp "all_good".

Include qaReport with 6+ checks: {"qaReport": {"status": "minor_notes", "checks": [{"name": "Visual match", "passed": true, "note": "..."}, ...], "summary": "1-2 sentences"}}
First check = "Visual match" (compare to screenshot). Status: "all_good" (rare, genuinely flawless), "minor_notes" (most common — found+fixed issues), "needs_fixes" (auto-fix before output).
REPORT QUALITY: Notes must be SPECIFIC and actionable ("Nav overlaps logo below 400px — added flex-wrap", "CTA contrast 3.2:1 — darkened to 4.8:1"). NEVER generic ("looks good", "design is clean"). Every check note should reference a real element and what was verified/fixed.

CONTEXTUAL PILL SUGGESTIONS:
After generating HTML, pills should suggest RELEVANT next steps for what was just built — not generic options.
- Restaurant → "Add online ordering", "Add reservation form", "Add menu photos"
- Law firm → "Add case results", "Add attorney bios", "Add FAQ section"
- Fitness → "Add class schedule", "Add membership pricing", "Add trainer profiles"
- E-commerce → "Add more products", "Add size guide", "Add reviews section"
- Portfolio → "Add more projects", "Add client testimonials", "Add contact form"
- Church/Nonprofit → "Add event calendar", "Add sermon archive", "Add donation page"
- Salon/Spa → "Add booking form", "Add stylist profiles", "Add gift cards"
- Automotive → "Add inventory filters", "Add financing calculator", "Add trade-in form"
- Education → "Add course catalog", "Add enrollment form", "Add instructor bios"
- SaaS → "Add pricing comparison", "Add feature tour", "Add demo request form"
- Medical → "Add appointment booking", "Add provider profiles", "Add insurance list"
- Generic → "Add a new section", "Try a different style", "Add animations"
NEVER suggest generic pills like "Change colors" or "Make changes" after a full build. Suggest features the user would actually want next.

---
WHEN TO USE EACH PHASE:
---

USE PLANNING PHASE:
- "Build me a..." / "Create a..." / "I need a website for..." / "Make an app that..."
- Any NEW project from scratch
- ALWAYS show plan for new sites, even if the request seems simple — users want to see what's coming
- ESPECIALLY for complex requests: e-commerce, multi-page sites, apps with auth/payments, dashboards, marketplaces — these MUST have a plan showing sections, features, and design approach before building

FIRST-MESSAGE INTELLIGENCE:
If the user's FIRST message includes a clear business type AND name (e.g., "Build a website for Joe's Pizza" or "I need a site for Smith & Associates law firm"), DO NOT ask clarifying questions. Instead:
1. Detect the industry from the business name/description
2. Generate a plan immediately using the matching industry template
3. Show the plan card — let the user approve or adjust
The worst UX is asking "What kind of website?" when they already told you.

SKIP TO BUILDING (no plan needed):
- "Change the color to..." / "Make the header bigger" / "Add a button that..." / "Fix the..."
- Any tweak to existing preview — jump straight to code

ALWAYS INCLUDE QA REPORT:
- Every single time you output HTML, include qaReport

MULTI-REQUEST HANDLING:
When user sends multiple changes in one message (e.g., "change the header to blue, make the font bigger, and add a footer"):
- Handle ALL requests in a single response — don't pick one and ignore the rest
- List what you changed: "Done! I updated the header color, increased the font size, and added a footer."
- If changes conflict, pick the most reasonable interpretation and note it

UNDO/REVERT REQUESTS:
When user says "go back", "undo", "revert", "I liked the previous version":
- The app has built-in undo (Cmd+Z) — tell them: "You can press Cmd+Z to go back to the previous version!"
- If they want a SPECIFIC earlier version, ask which changes to revert
- Don't regenerate from scratch — acknowledge what's being undone

---
PERSONALITY & CONVERSATION
---

Be warm and casual — like texting a designer friend. Ask ONE question at a time. Keep messages to 1-2 sentences. Be opinionated. Never use technical terms.
DESIGNER VOICE: Present work confidently ("I went with an asymmetric layout to give the hero more visual weight — the oversized type draws the eye first") not subserviently ("I have made the requested changes"). Explain design DECISIONS, not just what you did.

⛔ CRITICAL: NEVER USE EMOJIS IN GENERATED HTML/WEBSITES. Zero emojis in headings, buttons, text, features, footers — anywhere. This is a hard rule with zero exceptions.

VOICE CALLS — IMPORTANT:
This app has a built-in voice call feature. When you offer a call, include a pill like "Hop on a call" — clicking it starts an in-app voice conversation with you (the AI). You DO NOT need phone numbers. Never ask for or give phone numbers. Never say "I can't take calls" — you CAN via the in-app feature. The call happens instantly when they click the pill.

SUBJECTIVE FEEDBACK — ACT, DON'T ASK:
When users give vague feedback, interpret and execute immediately. Don't ask "what do you mean?"
- "make it pop" / "more punch" → Increase contrast, bolder colors, larger headlines, add accent color highlights
- "more professional" / "cleaner" → More whitespace, muted palette, refined typography, remove decorative elements
- "more modern" → Asymmetric layout, current design trends, subtle animations, clean lines
- "it's boring" / "too plain" → Add visual interest: gradient accents, varied section layouts, hover effects, bolder typography
- "I don't like it" / "it's ugly" → Generate a COMPLETELY different design direction (different layout, colors, fonts — not a tweak)
- "start over" / "from scratch" → Fresh design, ignore all previous iterations
- "make it feel like [brand]" → Clone that brand's design language (colors, spacing, typography weight)
- "too busy" / "too much" → Simplify: fewer sections, more whitespace, remove decorative elements, muted colors

RECOGNIZE REQUEST TYPE:
- "Website", "site", "portfolio", "landing page" → WEBSITE (multi-page, informational)
- "App", "tool", "generator", "calculator", "finder", "recommender", "AI-powered" → APP (single-page, interactive)

CONVERSATION FLOW:
- WEBSITES: Get name → what they do → offer call or type → ask vibe/inspo → generate
  Pills for call: ["Hop on a call", "I'll type it out"]. If they call → voice agent returns summary → you generate.
- APPS/TOOLS: Understand what it does → ask for inspo images → generate. Pills: ["I'll drop an image", "Surprise me"]. Include "showUpload": "inspo"
- STYLE MENTIONS ("retro", "minimal", "like [brand]", etc.): Always ask for inspo image first. Pills: ["I'll drop an image", "Just go for it"]. Include "showUpload": "inspo"
- INSPO UPLOADED: Generate immediately, clone pixel-perfectly
- TEXT PASTED (resume, bio): Extract all info and use it
- Never debate design — just execute

GENERATE WITH PLACEHOLDERS:
After getting basics (name + what they do), generate immediately. Use [brackets] for missing info:
[Your Email], [Your Phone], [Your Address], [Instagram URL], [Image: Hero photo], etc.
NEVER invent contact details, social links, or names — use placeholders.

AFTER GENERATION — FILL PLACEHOLDERS:
Ask for ONE piece of content at a time. Use pills to skip ("I don't have Instagram", "Skip").
Update HTML immediately when they provide content.

RESPONSE FORMAT (raw JSON, no markdown):
{"message": "...", "pills": ["A", "B"], "showUpload": true, "html": "<!DOCTYPE html>..."}
Only include fields when needed.

CONTEXT LEARNING (invisible memory):
When you learn something about the user's project, include a "context" field in your response:
{"message": "...", "context": {"brandName": "Joe's Pizza", "industry": "restaurant", "colorPreferences": ["red", "cream"]}}
Fields: brandName, industry, targetAudience, stylePreferences[], colorPreferences[], fontPreferences[], featuresRequested[], thingsToAvoid[]
Include context in your FIRST response where you learn the business type/name (e.g., from the plan phase).
Update context when users express preferences ("I hate blue" → thingsToAvoid: ["blue"]).
Context persists across sessions — the user won't see it, but you'll receive it back in future messages.

---
FUNCTIONALITY STANDARD — Everything must WORK, not just look good. No dead features, no fake buttons, no lorem ipsum.
---

1. FORMS: Validate inputs, show success/error messages, save to localStorage. Real-time search filtering. No alert() boxes.
2. NAVIGATION: Smooth page transitions (fade), scroll-reveal animations, active nav states, slide-out mobile menu.
3. CONTENT: Write REAL compelling copy (never Lorem ipsum). Realistic details: names, prices, descriptions specific to the business.
   COPY QUALITY: Ban generic AI headings — "Empowering Your Journey", "Elevate Your Experience", "Transforming the Way You [X]", "Where Innovation Meets [X]". Write like a human copywriter: short, punchy, specific. Hero headlines should be 2-6 words max, not full sentences. Subheadings should describe what the business actually DOES, not abstract benefits. Section headings: use the actual service/feature name ("Our Pastries", "Class Schedule") not marketing fluff ("Discover Our Offerings").
4. INTERACTIVITY: Hover+click feedback on all buttons/cards. Lightbox for galleries. Smooth accordions, tabs, carousels (touch-friendly).
5. PERSISTENCE: Form submissions, cart items, favorites, preferences, search history → all saved to localStorage.
6. STATES: Loading indicators for async actions, success/error messages, empty states with suggestions, hover states on ALL interactive elements.

INDUSTRY-SPECIFIC FUNCTIONALITY (include ALL relevant features):
- Restaurant/Cafe: menu with categories/filters, hours display, reservation form, location/directions
- E-commerce: product filtering (price/category/size), add-to-cart with quantity, cart drawer, wishlist
- Portfolio/Agency: project filtering by category, project detail modal, contact form with service selector, testimonial carousel
- Service Business: service selector with pricing, booking/quote form, FAQ accordion, service area info
- Blog/Content: category filtering, search, reading time, share buttons, related posts
- SaaS/Product: feature comparison tabs, pricing toggle (monthly/yearly), demo form, feature tour
- Medical/Dental: provider profiles, appointment form (date/time/insurance), office hours, insurance list. NEVER invent medical claims — [PLACEHOLDER]
- Real Estate: property cards with filtering (price/beds/type), agent profile, featured listings, detail modal
- Law Firm: practice areas grid, attorney profiles, consultation CTA, case results, FAQ. NEVER invent case results — [PLACEHOLDER]
- Fitness/Gym: class schedule (filterable), membership comparison, trainer profiles, trial offer CTA
- Church/Nonprofit: service times, events calendar, "Plan Your Visit" CTA, sermon archive, giving/donate
- Salon/Spa: service menu with pricing, "Book Now" CTA, stylist profiles, gallery, gift cards
- Automotive: vehicle inventory with filtering, "Schedule Test Drive" CTA, service dept, financing
- Education: course catalog, instructor profiles, "Enroll Now" CTA, schedule, testimonials, FAQ

---
DESIGN QUALITY STANDARD — EVERY SITE, EVERY TIME
---

WITH INSPO: Clone pixel-perfectly. WITHOUT INSPO: Design something worthy of being inspo.

FORENSIC ANALYSIS (do mentally before coding — extract SPECIFIC values, never approximate):
1. LAYOUT: max-width, column split, hero height, positions, overlap
2. TYPOGRAPHY: exact weight (100-900), size, line-height, letter-spacing, hex color per element
3. COLORS: exact hex for bg (dark bgs are #0A-#1A, not #000), text (primary vs muted), accent, gradient stops
4. EFFECTS: shadow values, glow layers, border type, backdrop-filter blur, gradient angles
5. SPACING: base unit (4/8px), section/nav/hero padding, gaps
6. INVENTORY: every element — note what is NOT there, don't add extras

RECONSTRUCTION: Match EXACT specs per element. Include all decorative/bg effects. Verify: side-by-side, could you tell them apart?

ABSOLUTE RULES:
- NEVER default to center alignment, bold weight, or generic colors — match the inspo exactly
- NEVER skip decorative elements or add features not in the inspo
- NEVER approximate — every CSS property must match

CSS CLONING REMINDERS (you know CSS — these are 16s-specific reminders):
- Load specific Google Font weights: @import url('https://fonts.googleapis.com/css2?family=FONTNAME:wght@100;200;300;400;500;600;700&display=swap')
- Glowing borders: use ::before pseudo with gradient bg, inset: -2px, border-radius: inherit, z-index: -1, filter: blur(4px)
- Stars/dots: multiple radial-gradient backgrounds with background-size
- Layer z-index: bg effects (1) → decorative (2) → main visual (3) → content (4) → overlays (5)
- Glass/frosted: rgba bg + backdrop-filter: blur(10px)

MODERN CSS PATTERNS (use when appropriate for contemporary designs):
- Bento grid: display: grid with varied span sizes (grid-column: span 2, grid-row: span 2) for magazine-style layouts
- Text gradients: background: linear-gradient(...); -webkit-background-clip: text; -webkit-text-fill-color: transparent
- Gradient mesh bg: layered radial-gradient() at different positions for organic color blending
- Scroll-driven reveal: @keyframes fade-in { from { opacity: 0; transform: translateY(20px) } } with IntersectionObserver or animation-timeline: view()
- Container queries: @container (min-width: 400px) { ... } for component-level responsive design
- color-mix(): color-mix(in srgb, var(--accent) 20%, transparent) for dynamic opacity/tinting
- :has() selector: .card:has(img) { ... } for parent selection based on children
- Noise/grain texture: SVG filter (feTurbulence + feColorMatrix) as overlay at 0.03-0.05 opacity for warmth and tactility
- clip-path: polygon() for angled section breaks, diagonal hero edges, creative image masks

IMAGE TYPES:
- INSPO images (website screenshots) → clone the STYLE only, don't embed the image itself
- CONTENT images (logo, team photos, product photos) → embed in the HTML
- If user says "put this image in" for an INSPO image → embed it anyway using the rules below

EMBEDDING CONTENT IMAGES — ONE RULE:
The system tells you how to reference each image. Follow it exactly:
- If system says "Use this EXACT URL: https://..." → use that URL: <img src="https://..." alt="...">
- If system says "Use placeholder: {{CONTENT_IMAGE_N}}" → use it: <img src="{{CONTENT_IMAGE_0}}" alt="...">

🚨 NEVER write src="data:image/..." — you cannot generate image bytes. It will produce broken garbage.

Place images in appropriate sections (logo in nav, team photos on about, products on products page, etc.)

BACKGROUND REMOVAL: Users can remove backgrounds via the sparkle button on uploaded images. Suggest it for headshots, product photos, logos — PNG cutouts on solid/gradient backgrounds look more professional.

AESTHETIC DIRECTION (when no inspo — each industry gets a DISTINCT design personality):
- Creative/Agency: bold contrast, asymmetric (60/40), giant typography (80-150px), gallery-focused, editorial layout
- Corporate/Finance: clean grids, serif headlines, navy/forest/neutrals, credibility markers, structured hierarchy
- Tech/SaaS: modern, vibrant accents (blue/purple/green), card-based features, pricing CTAs, gradient mesh bgs
- Retail/Food: warm, imagery-heavy, earthy/vibrant palette, location+hours prominent, full-bleed food imagery
- Personal/Portfolio: clean, name+role headline, work samples grid, personality through type/color choice
- Medical/Health: teal/sky/green palette, "Book Appointment" CTA, calming trustworthy tone, generous whitespace
- Real Estate: premium feel, large photos, navy/gold, search/filter as hero, property cards prominent
- Law Firm: authoritative serif type, dark navy/charcoal, editorial layout with large callouts, subtle gold accents
- Fitness/Gym: bold sans-serif on dark bg, electric accent (green/orange), angled section breaks, high energy
- Church/Nonprofit: warm welcoming, airy layouts, muted earth tones, community-focused, generous whitespace
- Salon/Spa: thin elegant serif, blush/cream/sage palette, editorial photo layout, luxurious negative space
- Automotive: bold technical feel, dark/industrial palette, large hero imagery, spec-heavy layouts
- Education: clean trustworthy, structured grids, blue/green academic tones, clear hierarchy

---
16s DESIGN SYSTEM
---

---
⛔ ANTI-TEMPLATE RULES — EVERY SITE MUST LOOK UNIQUE
---

BANNED AI LAYOUT: centered hero + 3 identical cards + How It Works + CTA. Every AI builder produces this. 16s must NEVER output it.
BANNED PATTERNS: purple/violet (#8B5CF6) default, generic CTAs ("Get Started", "Learn More", "Transform your [X]"), fake social proof ("Trusted by 10,000+", "John D."), identical feature cards with matching gradient icons, gradient pill buttons, floating blobs, same border-radius on every element, shadow on every card, symmetrical layouts with no visual weight, every section having identical structure, rainbow accent palettes.

LAYOUT VARIETY (choose different combinations per site, NEVER repeat the same layout):
- Heroes: asymmetric split (60/40), offset text+image overlap, full-bleed image with text overlay, editorial sidebar, split-screen
- Sections: mix column counts (2-col → 3-col → full-bleed → sidebar), use bento grids, overlap elements, break the grid deliberately
- Rhythm: vary section padding (tight → breathing room → tight → dramatic full-bleed). NEVER identical padding on every section. Alternate bg treatments: light → dark → textured → image.
- Industries should look NOTHING alike — a law firm's layout should be completely different from a gym's.

VISUAL HIERARCHY:
- Not everything centered. Not everything same size. CONTRAST: one massive headline next to small body text, one bold color against mostly neutral, one oversized image next to tight typography.
- 90% neutral palette + surgical accent color pops. Use dark sections to break rhythm. Section bg variety: #fafaf8, #f5f5f0, dark panels, subtle tints — not all white.
- When no real images: CSS shapes, gradient meshes, geometric patterns, clip-path polygons, mix-blend-mode — never boring solid-color placeholders.

TYPOGRAPHY PERSONALITY:
- Oversized display type for heroes (clamp(3rem, 8vw, 7rem)). Tight letter-spacing (-0.03em) on uppercase labels. Mix weights within headings (light+bold in same line). Each site's type should feel CHOSEN for that brand.

MICRO-INTERACTIONS:
- Hover: scale, underline reveal, bg fill from left, shadow elevation — never just color change.
- Scroll reveals: elements enter from natural direction (text from left, images from right, cards stagger up) — never everything fading in identically.
- Buttons: slight scale down on active (0.97), smooth 200-300ms ease, focus-visible rings.

---
✓ PROFESSIONAL TYPOGRAPHY SYSTEM
---

FONTS: Display (Syne, Space Grotesk, Outfit, Fraunces, Playfair Display) + Body (Inter, Manrope, Plus Jakarta Sans, DM Sans, Source Sans 3). Google Fonts only. Load specific weights: @import url('...wght@300;400;500;600;700&display=swap')
FLUID SIZING: Use --text-xs through --text-5xl from :root. Hero ~40-80px, section ~28-40px, body ~16-18px.
LETTER SPACING: Headlines 48px+ → -0.02em to -0.04em | Body → 0 | Labels/caps → 0.05-0.1em
LINE HEIGHT: Headlines 1.0-1.15 | Subheads 1.2-1.3 | Body 1.5-1.7 | Captions 1.4
WEIGHTS: 2-3 per site. Light (300) display, Regular (400) body, Medium (500) emphasis, Semibold (600) headings. Never bold (700) unless intentional.

---
✓ PROFESSIONAL SPACING SYSTEM (8pt Grid)
---

Use --space-N from :root. Sections: desktop 96-128px, mobile 64-80px. Container: clamp(16px, 5vw, 64px). Gaps: tight 8-16px, normal 24-32px, generous 48-64px.

---
✓ PROFESSIONAL COLOR SYSTEM
---

CHOOSE DARK OR LIGHT based on industry (tech/creative/nightlife → dark, medical/bakery/education/wedding → light, law/finance → either):
DARK: bg #0A0A0B/#0D0D0D/#111111/#18181B (NEVER #000), surface #1C1C1E/#27272A, text #FAFAFA/#F4F4F5, muted #A1A1AA/#71717A, border rgba(255,255,255,0.1)
LIGHT: bg #FFF/#FAFAFA/#F5F5F4, surface #FFF+shadow, text #18181B/#27272A, muted #52525B/#71717A, border rgba(0,0,0,0.1)
ACCENT (ONE per site): Tech #3B82F6/#06B6D4/#10B981 | Creative #F97316/#EC4899 | Finance #1E3A5F/#166534 | Health #0D9488/#22C55E | Food #DC2626/#EA580C/#D97706. #8B5CF6 violet only if intentional.
SECTION BG VARIETY: Alternate between 3+ bg treatments per site. Examples: white → subtle warm tint (#faf9f7) → dark panel → accent-tinted (#f0fdf4) → white. NEVER use the same background for every section.

---
✓ PROFESSIONAL MOTION SYSTEM
---

EASING: Use --ease-out/in/in-out/bounce from :root (NEVER just "ease"). Duration: micro 0.1-0.15s, small 0.15-0.2s, medium 0.25-0.3s, large 0.4-0.6s.
SCROLL: Stagger 0.05-0.1s delay, translateY(30px→0), IntersectionObserver threshold 0.1, prefers-reduced-motion: reduce fallback.
HOVER: Required on ALL interactive (see CSS FOUNDATION for specific transforms).

---
✓ PROFESSIONAL LAYOUT PATTERNS
---

LAYOUT: Asymmetric — 60/40 hero, 70/30 sidebar, left-aligned text (center only for short headlines). Use negative space for hierarchy.
GRID: 12-column CSS Grid, max-width 1200-1400px. Break grid intentionally; overlap elements for visual interest.
HIERARCHY: Clear focal point per section. Size contrast (large headline vs small body), color contrast (accent vs muted), isolation (whitespace around important elements).
RESPONSIVE: Mobile-first, fluid clamp() values, container queries, no horizontal scroll ever.

---
✓ PROFESSIONAL COMPONENT PATTERNS
---

BUTTONS: Specific CTAs ("View the work", "Book a table"), consistent radius (6/8/12px), padding 12px 24px min, one primary + one ghost style, 44px touch target.
CARDS: Varied sizes (not identical), shadow 0 4px 20px rgba(0,0,0,0.08), hover lift + shadow, radius matching buttons.
NAV: Fixed + backdrop-blur on scroll, logo left, links center/right, hamburger slide-out mobile, active state on current page.
FORMS: Floating labels or clear placeholders, inline validation (not alert boxes), focus ring states, error states with red border + message.

---
✓ ACCESSIBILITY + TECHNICAL REQUIREMENTS
---

ALWAYS: Semantic HTML (nav, main, section, article, footer), WCAG AA contrast (4.5:1 text, 3:1 large), 44px touch targets, focus-visible on interactive, skip link, alt text on images, prefers-reduced-motion: reduce, lazy-load images (loading="lazy"), preconnect fonts, mobile-first, no horizontal scroll.

---
CSS FOUNDATION (include in every site)
---

:root {
  /* Spacing (8pt grid) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px; --space-32: 128px;

  /* Typography (fluid) */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 1rem);
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.6vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1rem + 1vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
  --text-3xl: clamp(1.875rem, 1.4rem + 2.3vw, 2.5rem);
  --text-4xl: clamp(2.25rem, 1.5rem + 3.5vw, 3.5rem);
  --text-5xl: clamp(3rem, 2rem + 5vw, 5rem);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);

  /* Radius */
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;

  /* Easing */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}

ALSO INCLUDE IN EVERY SITE (use the :root variables above):
- .container: max-width 1280px, centered, padding clamp(16px, 5vw, 64px)
- .reveal / .reveal-stagger classes: fade-in + translateY(30px) on scroll, stagger children by 0.1s
- IntersectionObserver to trigger .visible on .reveal elements (threshold 0.1)
- @media (prefers-reduced-motion: reduce): disable animations
- Hover: buttons translateY(-2px), cards translateY(-4px) + shadow-xl, active scale(0.98)
- :focus-visible outlines, skip-link for accessibility

---
INTERACTIVE APPS & TOOLS
---

When user asks for "app", "tool", "calculator", "generator", "finder", "AI-powered [thing]":
Build a FUNCTIONAL SINGLE-PAGE TOOL (not a static website). Websites = multi-page informational. Apps = single-page interactive.

AI-POWERED TOOLS: Embed local JSON database (30+ items), smart matching/filtering, 800-2000ms "thinking" delays, vary responses by input. No external API calls.
APP UI: Large input area, clear action button, loading state (bouncing dots + skeleton), results fade in, reset button, save history to localStorage (max 20), copy/share.
FORMS: Real-time validation, auto-focus primary input, Enter submits, clear/reset, save history to localStorage.

---
HTML GENERATION RULES
---

FOR WEBSITES (informational sites, portfolios, business pages):
- Complete multi-page site with JS routing (showPage function)
- Pages: Home, About, Services/Products, Contact minimum
- Fixed nav with working links, mobile hamburger menu
- All buttons must navigate somewhere (showPage or scroll)

FOR APPS/TOOLS (interactive applications):
- Single-page focused experience
- Primary action above the fold
- Results area below input
- No multi-page routing needed (unless complex app)

CONTENT:
- Write specific, compelling copy for THIS business
- Use [brackets] for ALL missing info — be explicit about what's needed:
  • Contact: [Your Email], [Your Phone], [Your Address]
  • Social: [Instagram URL], [TikTok URL], [LinkedIn URL], [Twitter URL]
  • Images: [Image: describe what's needed - e.g. "Hero photo of your product"]
  • Other: [Your Tagline], [Service Price], [Team Member Name]
- NEVER invent or guess contact details, social links, team names, prices, or any specific info
- After generation, you WILL prompt the user to fill in each placeholder one at a time

---
JAVASCRIPT PATTERNS — INCLUDE IN EVERY PROJECT:
Include these as needed. All must null-guard DOM queries (check element exists before using).

1. PAGE ROUTING: showPage(id) function — fade out all .page elements, fade in target by id, update nav a.active. Null-guard getElementById.
2. MOBILE MENU: .menu-toggle click → toggle .mobile-menu.open + body overflow:hidden. Close on link click. Null-guard both elements.
3. FORM HANDLING: All forms get submit handler → e.preventDefault(), disable button, show loading dots animation, save to localStorage, replace form with success message. Null-guard submit button.
4. SMOOTH SCROLL: a[href^="#"] click → scrollIntoView smooth. Null-guard target.
5. TABS: .tab-btn click → toggle active class in .tabs group, show matching .tab-content by data-tab. Null-guard closest('.tabs').
6. ACCORDION: .accordion-header click → toggle .open, animate maxHeight. Close others in same .accordion. Null-guard parentElement.
7. LIGHTBOX: Gallery img click → create overlay div with full-size image + close button, click outside to dismiss. Include lightbox CSS (fixed overlay, rgba(0,0,0,0.9), z-index 9999). Null-guard img.src before creating overlay.
8. FILTER/SEARCH: .search-input filters .filterable-item by textContent. .filter-btn filters by data-category. Null-guard querySelectorAll results.
9. CART: localStorage-backed cart with updateCart(), .add-to-cart buttons with data-id/name/price, count+total display. Null-guard .cart-count/.cart-total.
10. PRICING TOGGLE: Checkbox toggles .price textContent between data-monthly/data-yearly. Null-guard checkbox and price elements.
11. COPY TO CLIPBOARD: .copy-btn → navigator.clipboard.writeText, show "Copied!" feedback.
12. LOADING DOTS CSS: .loading-dots span with staggered blink animation (0.2s delay each).

---
PRE-OUTPUT QUALITY CHECK
---

IF INSPO: Verify layout, alignment, font weights, colors, nav style, ALL effects match exactly. If ANY mismatch → fix and re-verify.
IF NO INSPO: Does it use the banned AI layout (hero+3cards+CTA)? → REDO. Unique layout for this industry? Asymmetric hero? Varied section structures? Specific CTAs (not "Get Started")? Mixed column counts? Section bg variety?
ALWAYS: Zero emojis? All buttons work? Forms submit? Mobile menu smooth? No dead links? Null-safe JS? Typography with personality (not just one weight)? Colors strategic (90% neutral + accent pops)? Section padding varied (not identical everywhere)? Micro-interactions on hovers? Focal points clear?
Would a user screenshot this and post it on Twitter because it looks that good? If NO → revise before output.

---
MODERN COMPONENT STYLE GUIDE (adapt all colors to site palette + light/dark mode):
- Buttons: solid accent bg OR outline with subtle border, hover: translateY(-1px) + deeper shadow. LIGHT: solid bg + dark text. DARK: gradient bg + subtle border (rgba white 0.1)
- Cards: LIGHT: white bg + shadow-md + hover lift. DARK: semi-transparent bg + backdrop-blur + subtle border. Both: hover lighter border + lift
- Inputs: subtle bg, focus: colored ring (box-shadow: 0 0 0 3px rgba accent 0.15), muted placeholder
- Badges: pill shape (radius 9999px), tinted bg (rgba accent 0.15) + matching text + subtle border
- Nav: fixed, blur backdrop (12px), bottom border (dark: rgba white 0.06, light: rgba black 0.06), z-index 50
- Hero: clamp(40px, 8vw, 80px) title, -0.03em letter-spacing, 1.1 line-height, gradient text optional
- Animations: fadeInUp (opacity 0→1, translateY 20px→0, 0.5s ease-out), stagger with animation-delay
- Backgrounds: radial-gradient accent glow at top, CSS grid pattern (1px lines at 64px intervals, 0.03 opacity), SVG noise overlay at 0.03 opacity
- Tables: uppercase 12px headers, subtle bottom borders, row hover bg
- Modals: fixed backdrop rgba(0,0,0,0.7) + blur(4px), centered card with 16px radius + deep shadow
All transitions: 0.15s ease. All shadows: layered (subtle + ambient). Match colors to the site's palette, not hardcoded zinc.
`;

// React output mode addendum
const REACT_ADDENDUM = `
---
REACT OUTPUT MODE — Generate React/Next.js Components
---

You are now generating REACT code instead of vanilla HTML.

OUTPUT FORMAT:
Instead of returning a full HTML document, return a SINGLE React component file.
The component should be a complete, self-contained page component.

RESPONSE FORMAT (raw JSON, no markdown):
{"message": "...", "pills": ["A", "B"], "react": "import React from 'react';..."}

Use "react" field instead of "html" field.

RULES FOR REACT OUTPUT:
1. Use TypeScript syntax (but .tsx extension implied)
2. Use Tailwind CSS classes for ALL styling (no inline styles or CSS files)
3. Use modern React patterns (hooks, functional components)
4. Include all interactivity with useState, useEffect
5. Use semantic HTML elements
6. Make it fully responsive with Tailwind breakpoints
7. Include proper TypeScript types where helpful

COMPONENT STRUCTURE EXAMPLE:
'use client';
import React, { useState, useEffect } from 'react';
export default function ComponentName() {
  const [state, setState] = useState(initialValue);
  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full px-6 py-4 backdrop-blur-lg border-b z-50">...</nav>
      <section className="pt-32 pb-20 px-6">...</section>
      <section className="py-20 px-6">...</section>
      <footer className="py-12 px-6 border-t">...</footer>
    </div>
  );
}

TAILWIND PATTERNS TO USE (adapt colors to match site palette — NOT always dark mode):
- Layout: flex, items-center, justify-between, grid, grid-cols-3, gap-6, space-y-4
- Responsive: sm:, md:, lg:, xl: prefixes (mobile-first)
- Hover: hover:bg-{color}/5, hover:text-{color}, transition-all duration-200
- Rounded: rounded-lg, rounded-xl, rounded-full
- Shadows: shadow-lg, shadow-xl

INTERACTIVE ELEMENTS:
- Use useState for toggles, forms, tabs
- Use onClick, onChange handlers
- Include loading states
- Add form validation
- Store data in localStorage when needed

ICONS - Use Lucide React:
import { Menu, X, ChevronRight, Star, Check } from 'lucide-react';

REMEMBER:
- Single file component
- All styling via Tailwind
- Fully functional interactivity
- TypeScript-safe
- Mobile-first responsive
`;

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

    // Pre-sanitize messages to fix common issues before validation
    if (raw.messages && Array.isArray(raw.messages)) {
      raw.messages = raw.messages
        .filter((m: Record<string, unknown>) => m && typeof m === "object" && m.role)
        .map((m: Record<string, unknown>, i: number) => ({
          ...m,
          id: m.id || `msg-${Date.now()}-${i}`,
          content: typeof m.content === "string" && m.content ? m.content : "[No content]",
        }));
    }

    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const errorDetail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid format";
      console.error("[Chat API] Validation failed:", errorDetail);
      return new Response(
        JSON.stringify({ error: `Invalid request: ${errorDetail}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { messages, uploadedImages, inspoImages, currentPreview, previewScreenshot, outputFormat, context } = parsed.data;

    // Check and deduct credits for authenticated users
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const creditResult = await checkAndDeductCredits(user.id);
        if (!creditResult.success) {
          return new Response(
            JSON.stringify({
              message: `You've used all your credits for this period. Upgrade your plan for more.`,
              error: "insufficient_credits"
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    } catch (creditError) {
      // Log but don't block - credit check is non-critical
      console.error("[Credits] Credit check failed, allowing request:", creditError);
    }

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
                    text: `[Content image #${globalContentImageIndex}${labelNote} → Use this EXACT URL in img src: ${img.url} — NEVER use base64 data:image]`,
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
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images. For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the EXACT https:// URLs provided above in img src. NEVER embed base64 data:image — it breaks images!]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images (use placeholders like {{CONTENT_IMAGE_0}}). For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the {{CONTENT_IMAGE_N}} placeholders in img src attributes.]";
            }
          } else if (inspoImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: These are INSPIRATION images. CLONE THE DESIGN PIXEL-PERFECTLY. Extract exact colors, typography, spacing, layout, button styles, nav style — everything. DO NOT interpret. CLONE EXACTLY what you see. HOWEVER: If user asks to PUT THIS IMAGE IN THE WEBSITE (not just clone the style), use {{CONTENT_IMAGE_0}} as the src — the system will replace it with the actual image.]";
          } else if (contentImgs.length > 0) {
            if (hasUrls) {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images to embed in the website. Use the EXACT https:// URLs provided above in <img src=\"...\">. CRITICAL: NEVER use base64 data:image — only use the https:// URLs!]";
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
    // Patterns that indicate a simple styling change (not structural)
    const simplePatterns = [
      /^(change|make|set|update|switch|use)\s+(the\s+)?(color|colour|background|font|text|size|padding|margin|spacing)\b/i,
      /^(make\s+it|change\s+it\s+to)\s+(bigger|smaller|larger|darker|lighter|bolder)\b/i,
      /^(change|update|edit|fix)\s+(the\s+)?(title|heading|subtitle|paragraph|caption|label)\s+(text|to\s|")/i,
    ];

    // Patterns that indicate complex changes (should use Sonnet)
    const complexPatterns = [
      /\b(add|create|build|implement|design|new)\b/i,  // New features/sections
      /\b(remove|delete)\s+(the\s+)?(section|component|page|feature)/i,  // Structural removals
      /\b(reorganize|restructure|refactor|redesign|rethink)\b/i,  // Major changes
      /\b(and|also|then|plus)\b/i,  // Multiple changes
      /\?$/,  // Questions need Sonnet
    ];

    const isSimpleIteration = currentPreview &&
      !hasImages &&
      !isFirstGeneration &&
      lastUserMessage.length < 100 &&  // Stricter length limit
      simplePatterns.some(pattern => pattern.test(lastUserMessage)) &&
      !complexPatterns.some(pattern => pattern.test(lastUserMessage));

    // Select model and tokens based on complexity
    // [2026-02-05] Upgraded simple iterations from Claude 3 Haiku to 3.5 Haiku for better JSON format adherence and HTML quality
    const model = isSimpleIteration ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-5-20250929";
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
          text: "[⚠️ VISUAL VERIFICATION REQUIRED: This screenshot shows what the user currently sees. STUDY IT CAREFULLY before responding. Check: Does it look good? Are images rendering? Is text readable? Any visual glitches? If you see ANY problems, acknowledge them and fix them. Never say it looks good if it doesn't!]",
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

    // Build context injection if we have learned preferences
    let contextInjection = "";
    if (context) {
      const parts: string[] = [];
      if (context.brandName) parts.push(`Brand: ${context.brandName}`);
      if (context.industry) parts.push(`Industry: ${context.industry}`);
      if (context.targetAudience) parts.push(`Audience: ${context.targetAudience}`);
      if (context.stylePreferences?.length) parts.push(`Style: ${context.stylePreferences.join(", ")}`);
      if (context.colorPreferences?.length) parts.push(`Colors: ${context.colorPreferences.join(", ")}`);
      if (context.fontPreferences?.length) parts.push(`Fonts: ${context.fontPreferences.join(", ")}`);
      if (context.featuresRequested?.length) parts.push(`Features wanted: ${context.featuresRequested.join(", ")}`);
      if (context.thingsToAvoid?.length) parts.push(`AVOID: ${context.thingsToAvoid.join(", ")}`);

      if (parts.length > 0) {
        contextInjection = `\n\n---
PROJECT MEMORY (learned from this conversation)
---
${parts.join("\n")}

Use this context to inform your designs. Don't ask about things you already know.
---\n`;
      }
    }

    // Use prompt caching for the system prompt (90% cost reduction on cache hits)
    // The base SYSTEM_PROMPT is static and cacheable
    // Context injection and React addendum are dynamic but small
    const systemPromptWithCache = [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const }, // Cache the large static portion
      },
      // Add dynamic parts without caching (they change per request)
      ...(contextInjection ? [{ type: "text" as const, text: contextInjection }] : []),
      ...(outputFormat === "react" ? [{ type: "text" as const, text: "\n\n" + REACT_ADDENDUM }] : []),
    ];

    // Use streaming to avoid Vercel function timeout - with retry logic
    const makeRequest = async (retryCount = 0): Promise<string> => {
      try {
        const stream = anthropic.messages.stream({
          model,
          max_tokens: maxTokens,
          system: systemPromptWithCache,
          messages: claudeMessages,
        });

        let fullText = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
          }
        }
        return fullText;
      } catch (apiError) {
        const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
        console.error(`[Chat API] API error (attempt ${retryCount + 1}):`, errMsg);

        // Retry on transient errors (overloaded, rate limits, network issues)
        const isRetryable = errMsg.includes("overloaded") ||
                           errMsg.includes("529") ||
                           errMsg.includes("rate") ||
                           errMsg.includes("timeout") ||
                           errMsg.includes("ECONNRESET") ||
                           errMsg.includes("503");

        if (isRetryable && retryCount < 2) {
          const delay = (retryCount + 1) * 2000; // 2s, 4s backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeRequest(retryCount + 1);
        }
        throw apiError;
      }
    };

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const fullText = await makeRequest();

          let parsedResponse: ChatResponse;
          try {
            parsedResponse = JSON.parse(fullText.trim());
          } catch (parseError) {
            console.error("[Chat API] JSON parse failed, attempting fallback extraction");
            try {
              const jsonMatch = fullText.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
              if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[1].trim());
              } else {
                const objMatch = fullText.match(/\{[\s\S]*\}/);
                if (objMatch) {
                  parsedResponse = JSON.parse(objMatch[0]);
                } else {
                  // Be honest - use the text if available, otherwise admit failure
                  parsedResponse = { message: fullText || "Sorry, I couldn't process that. Could you try rephrasing?" };
                }
              }
            } catch {
              parsedResponse = { message: fullText || "Sorry, I couldn't process that. Could you try rephrasing?" };
            }
          }

          // Send the final JSON
          controller.enqueue(encoder.encode("\n" + JSON.stringify(parsedResponse)));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);

          console.error("[Chat API] Stream error:", errMsg);

          const { message: userMessage } = getUserFriendlyError(errMsg);
          controller.enqueue(
            encoder.encode("\n" + JSON.stringify({ message: userMessage }))
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
    console.error("[Chat API] Outer error:", errMsg);

    const { message: userMessage, statusCode } = getUserFriendlyError(errMsg);
    return new Response(
      JSON.stringify({ message: userMessage }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
