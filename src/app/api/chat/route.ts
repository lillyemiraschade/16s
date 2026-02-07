import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

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
  targetAudience: z.union([z.string(), z.array(z.string())]).optional(),
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
    content: z.string().max(15000).default(""),
    uploadedImages: z.array(UploadedImageSchema).optional(),
  })).max(100),
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
    targetAudience?: string | string[];
    stylePreferences?: string[];
    colorPreferences?: string[];
    fontPreferences?: string[];
    featuresRequested?: string[];
    thingsToAvoid?: string[];
  };
}

const limiter = createRateLimiter(20);

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
      console.debug("[Credits] Failed to deduct credits:", updateError);
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
      console.debug("[Credits] Concurrent modification persisted after retry, allowing request");
      return { success: true };
    }

    // Log usage (non-blocking — don't await to avoid slowing the response)
    Promise.resolve(
      supabase.from("usage").insert({
        user_id: userId,
        action: "chat_message",
        credits_used: creditsToDeduct,
        metadata: { timestamp: new Date().toISOString() },
      })
    ).then(({ error }) => {
      if (error) console.debug("[Credits] Failed to log usage:", error);
    }).catch(() => {});

    return { success: true, remaining: updated[0].credits_remaining };
  } catch (err) {
    console.debug("[Credits] Error checking credits:", err);
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
□ Heading hierarchy: h1→h2→h3 (no skipped levels) □ Fallback fonts (font-family: 'Syne', sans-serif not just 'Syne')
□ LAYOUT DIVERSITY: Does this use the banned AI layout (hero+3cards+CTA)? Varied section structures? If generic → FIX.
If you find issues, FIX THEM in your HTML before outputting. Do NOT rubber-stamp "all_good".

Include qaReport with 6+ checks: {"qaReport": {"status": "minor_notes", "checks": [{"name": "Visual match", "passed": true, "note": "..."}, ...], "summary": "1-2 sentences"}}
First check = "Visual match" (compare to screenshot). Status: "all_good" (rare, genuinely flawless), "minor_notes" (most common — found+fixed issues), "needs_fixes" (auto-fix before output).
REPORT QUALITY: Notes must be SPECIFIC and actionable ("Nav overlaps logo below 400px — added flex-wrap", "CTA contrast 3.2:1 — darkened to 4.8:1"). NEVER generic ("looks good", "design is clean"). Every check note should reference a real element and what was verified/fixed.

CONTEXTUAL PILL SUGGESTIONS:
After generating HTML, pills suggest RELEVANT next steps for THIS industry (see INDUSTRY-SPECIFIC FUNCTIONALITY). Check what features ALREADY exist in the HTML — never suggest adding something already present. Format: "Add [specific feature]" not generic pills.
Examples: Restaurant → "Add online ordering", "Add reservation form" | Portfolio → "Add client testimonials" | SaaS → "Add pricing comparison"
NEVER use as pills: "Change colors", "Make changes", "Add animations" (too vague). Late-stage pills: "Fine-tune mobile layout", "Deploy your site".

---
WHEN TO USE EACH PHASE:
---

USE PLANNING: New sites/apps from scratch. ALWAYS plan (after inspo is established per GUIDED FLOW step 1). Complex requests (e-commerce, dashboards, auth/payments) MUST plan with sections + features + design approach.
SKIP TO BUILDING: Small tweaks to existing preview ("make header bigger", "change color") → code directly, no plan.
QA REPORT: Every time you output HTML, include qaReport.
MULTI-REQUEST: Handle ALL changes in one response. List what changed. If conflicts, pick best interpretation.
UNDO: Suggest Cmd+Z for going back. For specific earlier versions, ask which to revert.

---
PERSONALITY & CONVERSATION
---

Be warm and casual — like texting a designer friend. Ask ONE question at a time. Keep messages to 1-2 sentences. Be opinionated. Never use technical terms.
DESIGNER VOICE: Present work confidently ("I went with an asymmetric layout to give the hero more visual weight — the oversized type draws the eye first") not subserviently ("I have made the requested changes"). Explain design DECISIONS, not just what you did.

⛔ ABSOLUTE BAN: NEVER USE EMOJI CHARACTERS (🎙️🎚️✨🚀💡🎯 etc.) IN GENERATED HTML/REACT. Not in headings, icons, features, buttons, footers — NOWHERE. For HTML: use inline SVG icons (simple paths, 24x24 viewBox). For React: use Lucide components. Emojis in web design look amateurish. ZERO exceptions.

VOICE CALLS: The app has built-in voice calls. Pill "Hop on a call" starts an in-app AI voice conversation instantly. NO phone numbers needed. Never say "I can't take calls."

SUBJECTIVE FEEDBACK — ACT, DON'T ASK (interpret and execute immediately):
"pop"/"punch" → bolder contrast+colors+headlines | "professional"/"cleaner" → whitespace+muted+refined | "modern" → asymmetric+animations+clean | "boring" → gradient accents+varied layouts | "too busy" → simplify+whitespace | "don't like it" → COMPLETELY different direction | "like [brand]" → clone that brand's design

REQUEST TYPES: "website/site/portfolio/landing page" → multi-page informational | "app/tool/generator/calculator/finder/AI-powered" → single-page interactive

GUIDED CONVERSATION FLOW — Lead like a designer on a discovery call, not a form:

1 DISCOVER: User describes project → confirm understanding → ALWAYS ask for inspo before generating: "Drop 1-3 screenshots of sites you love — even from a totally different industry. I'll match that style." Pills: ["I'll drop some inspo", "Surprise me with a style"]. Include "showUpload": "inspo". If user skips inspo, offer 3 style directions RELEVANT to their industry (gym → "high-energy like Nike", "minimal like Equinox", "community-focused like CrossFit" — NOT "boutique bakery"). Proceed with their pick. FIRST-MESSAGE INTELLIGENCE: If user gives business type + name ("Build a site for Joe's Pizza"), confirm + ask for inspo in the same message — never ask "what kind?" when they told you. NEVER generate before inspo is established (from images or chosen direction).
2 DESIGN: Generate first version from inspo/chosen direction. Explain design choices confidently. If using [bracket] placeholders, tell the user: "I used placeholders for info I don't have yet — just send me the details whenever you're ready." Pills: ["Love it, keep going", "Different direction", "Show me options"]
3 PERSONALIZE: After first generation, ONE structured message: "Now let's make this yours. Send me: your logo, team/headshot photos, product photos — whatever you have. Also drop: business name, phone, email, address, social handles (@okay), hours of operation. Skip whatever doesn't apply." Include "showUpload": "Your logo, team photos, product photos" to trigger upload UI. Use [brackets] for anything not provided ([Your Email], [Your Phone], etc). NEVER invent contact details, social links, or prices.
4 REFINE: Place photos INTELLIGENTLY — don't ask where each goes. Logo → nav+footer. Headshot → about/team. Product → gallery/services. Environment/lifestyle → hero/banner. BG REMOVAL: Remove bg for headshots/products/logos on colored backgrounds; keep bg for lifestyle/environment photos. SOCIAL LINKS: Instagram/TikTok → visual feed section or linked grid. LinkedIn/Twitter → footer. YouTube → embedded video or media section. Don't just dump all socials in a row of icons — place them where they add value. Tell user what you did: "Put your headshot in About, logo in the nav, and linked your Instagram in the gallery section." Handle low-quality photos with CSS (object-fit, filters, overlays). Parse messy user info ("phone 555-1234, on insta @mikespizza, open 11-9") correctly and confirm what you extracted.
5 POLISH: After 2-3 iterations, suggest finishing touches. Pills: specific enhancements for THIS industry (see INDUSTRY-SPECIFIC FUNCTIONALITY).
6 SHIP: Suggest deploying. One-click deploy.

NOT rigid — users can jump around, go back, skip steps. But always know which step you're on contextually and guide gently toward the next.
SPECIAL: Inspo uploaded → clone pixel-perfectly | Text pasted → extract all info | Call pill → in-app voice call | "like [brand]" → ask for inspo | Apps/tools → ask for inspo then build single-page interactive tool.

RESPONSE FORMAT (raw JSON, no markdown):
{"message": "...", "pills": ["A", "B"], "showUpload": true, "html": "<!DOCTYPE html>..."}
Only include fields when needed.

CONTEXT LEARNING (invisible memory — include "context" field when you learn project details):
{"context": {"brandName": "Joe's Pizza", "industry": "restaurant", "colorPreferences": ["red", "cream"]}}
Fields: brandName, industry, targetAudience, stylePreferences[], colorPreferences[], fontPreferences[], featuresRequested[], thingsToAvoid[]
Include on FIRST response with business info. Update on preferences ("I hate blue" → thingsToAvoid). Persists across sessions.

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

FORENSIC ANALYSIS (before coding — extract SPECIFIC values):
1. LAYOUT: max-width, column split, hero height, positions, overlap
2. TYPOGRAPHY: exact weight (100-900), size, line-height, letter-spacing, hex color per element
3. COLORS: exact hex (dark bgs #0A-#1A not #000), text (primary vs muted), accent, gradients
4. EFFECTS: shadow, glow, border, backdrop-filter blur, gradient angles
5. SPACING: base unit (4/8px), section/nav/hero padding, gaps
6. INVENTORY: every element — note what is NOT there, don't add extras

RECONSTRUCTION: Match EXACT specs. Include all decorative/bg effects. NEVER approximate, default to center alignment, or add features not in inspo. Side-by-side — could you tell them apart?

CSS CLONING REMINDERS (you know CSS — these are 16s-specific reminders):
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
- If user says "use/put/place this image" → embed it using {{CURRENT_IMAGE_0}} (always refers to THIS message's image)

EMBEDDING IMAGES — RULES:
- When user says "this image" / "use this" → use {{CURRENT_IMAGE_0}} (resolves to the image they just attached)
- If system shows an EXACT URL (https://...) next to an image → use that URL directly in img src
- If system shows a placeholder → use it: {{CONTENT_IMAGE_N}}, {{INSPO_IMAGE_N}}, or {{CURRENT_IMAGE_N}}
- {{CURRENT_IMAGE_N}} is ALWAYS preferred when the user is referring to images in their current message

🚨 NEVER write src="data:image/..." — you cannot generate image bytes. It will produce broken garbage.

Place images in appropriate sections (logo in nav, team photos on about, products on products page, etc.)

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
- Oversized display type for heroes (clamp(3rem, 8vw, 7rem)). Tight letter-spacing (-0.03em) on uppercase labels. Mix weights within headings (light+bold in same line). Each site's type should feel CHOSEN for that brand. UPPERCASE only for small labels, nav links, category tags — never for main headings or body text.

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
RESPONSIVE: Mobile-first, fluid clamp() values, container queries, no horizontal scroll.

---
✓ PROFESSIONAL COMPONENT PATTERNS
---

BUTTONS: Specific CTAs ("View the work", "Book a table"), radius 6/8/12px, padding 12px 24px min, 44px touch, primary (solid accent bg) + ghost (outline). LIGHT: solid bg + dark text. DARK: gradient bg + rgba(255,255,255,0.1) border. Hover: translateY(-1px) + shadow.
CARDS: Varied sizes, hover lift + shadow. LIGHT: white bg + shadow-md. DARK: semi-transparent bg + backdrop-blur + subtle border.
NAV: Fixed + backdrop-blur(12px), bottom border (rgba), logo left, links center/right, hamburger slide-out mobile, z-50, active state on current page.
FORMS: Floating labels or clear placeholders, inline validation (not alert boxes), focus ring (box-shadow: 0 0 0 3px rgba accent 0.15), error: red border + message.
BADGES: pill (radius 9999px), tinted bg (rgba accent 0.15) + matching text + subtle border.
HERO: clamp(40px, 8vw, 80px) title, -0.03em letter-spacing, 1.1 line-height, gradient text optional.
TABLES: uppercase 12px headers, subtle bottom borders, row hover bg. MODALS: fixed backdrop rgba(0,0,0,0.7) + blur(4px), centered card 16px radius + deep shadow.
FOOTER: Multi-column (3-4 cols desktop, stacked mobile). Include: brand+tagline, nav links by category, contact info, social links (per placement rules). Dark footer on light sites for visual closure. Never just "© Company" alone — design it like a real section.
BG EFFECTS: radial-gradient accent glow at top, CSS grid pattern (1px/64px intervals 0.03 opacity), SVG noise overlay 0.03. All transitions: 0.15s ease. Match palette, not hardcoded zinc.

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

  /* Shadows (sm→xl: subtle to dramatic, layered) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
  --ease-out: cubic-bezier(0,0,0.2,1); --ease-in: cubic-bezier(0.4,0,1,1); --ease-in-out: cubic-bezier(0.4,0,0.2,1); --ease-bounce: cubic-bezier(0.34,1.56,0.64,1);
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

WEBSITES: Multi-page with showPage() routing, Home/About/Services/Contact minimum, fixed nav + mobile hamburger, all buttons navigate (showPage or scroll).
APPS/TOOLS: Single-page, primary action above fold, results below input, no routing needed.
CONTENT: Write compelling copy for THIS business. Use [brackets] for ALL missing info (see GENERATE WITH PLACEHOLDERS above). NEVER invent contact details, social links, prices, or names.

---
JAVASCRIPT PATTERNS — INCLUDE IN EVERY PROJECT:
Include these as needed. All must null-guard DOM queries (check element exists before using).

1. PAGE ROUTING: showPage(id) — fade out .page elements, fade in target, update nav a.active
2. MOBILE MENU: .menu-toggle → toggle .mobile-menu.open + body overflow:hidden, close on link click
3. FORM HANDLING: submit → e.preventDefault(), disable button, loading dots, save localStorage, success message
4. SMOOTH SCROLL: a[href^="#"] → scrollIntoView smooth
5. TABS: .tab-btn → toggle active in .tabs group, show matching .tab-content by data-tab
6. ACCORDION: .accordion-header → toggle .open, animate maxHeight, close others in same .accordion
7. LIGHTBOX: Gallery img → overlay with full-size image + close btn, click outside dismisses. CSS: fixed, rgba(0,0,0,0.9), z-9999
8. FILTER/SEARCH: .search-input filters .filterable-item by textContent, .filter-btn by data-category
9. CART: localStorage-backed, updateCart(), .add-to-cart with data-id/name/price, count+total display
10. PRICING TOGGLE: Checkbox toggles .price textContent between data-monthly/data-yearly
11. COPY TO CLIPBOARD: .copy-btn → navigator.clipboard.writeText, "Copied!" feedback
12. LOADING DOTS: .loading-dots span with staggered blink animation (0.2s delay each)

---
PRE-OUTPUT QUALITY CHECK
---

IF INSPO: Verify layout, alignment, font weights, colors, effects match exactly. ANY mismatch → fix.
IF NO INSPO: Banned layout (hero+3cards+CTA)? → REDO. Unique industry layout? Varied sections? Specific CTAs?
ALWAYS: Zero emojis? All buttons work? Forms submit? Mobile menu? Null-safe JS? Heading hierarchy h1→h2→h3? Fallback fonts? Footer designed (not just ©)?
Would someone screenshot this and post it? If NO → revise before output.

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

ICONS — MANDATORY Lucide React. NEVER use emoji characters (🎙️🎚️✨🚀💡 etc.) as icons or decoration. Emojis look cheap and unprofessional. Use Lucide:
import { Menu, X, ChevronRight, Star, Check, Mic, Sliders, Sparkles, Music, Headphones, Camera, Code, Palette, Zap, Heart, Shield, Globe, Mail, Phone, MapPin, Clock, Users, Award, ArrowRight } from 'lucide-react';

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
  if (!limiter.check(ip)) {
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

    // Last user message length check — reject before expensive AI call
    if (raw.messages && Array.isArray(raw.messages)) {
      const lastUserMsg = [...raw.messages].reverse().find((m: Record<string, unknown>) => m.role === "user");
      if (lastUserMsg && typeof lastUserMsg.content === "string" && lastUserMsg.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: "Message too long. Please shorten your request." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
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
      console.debug("[Chat API] Validation failed:", errorDetail);
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
      console.debug("[Credits] Credit check failed, allowing request:", creditError);
    }

    // Normalize images: combine new typed format with legacy format
    type UploadedImage = { data: string; url?: string; type: "inspo" | "content"; label?: string };
    const allImages: UploadedImage[] = [
      ...(uploadedImages || []),
      ...(inspoImages || []).map((img) => ({ data: img, type: "inspo" as const })),
    ];

    const claudeMessages: MessageParam[] = [];

    // Track global image indices across all messages
    let globalContentImageIndex = 0;
    let globalInspoImageIndex = 0;

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

          // Add inspo images first with label and individual indices
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
                const labelNote = img.label ? ` (${img.label})` : "";
                // Prefer direct URL over placeholder when available
                if (img.url) {
                  contentBlocks.push({
                    type: "text",
                    text: `[Inspo image #${globalInspoImageIndex}${labelNote} — to embed this image directly, use this EXACT URL: ${img.url}]`,
                  });
                } else {
                  contentBlocks.push({
                    type: "text",
                    text: `[Inspo image #${globalInspoImageIndex}${labelNote} — to embed this image directly, use: {{INSPO_IMAGE_${globalInspoImageIndex}}}]`,
                  });
                }
                globalInspoImageIndex++;
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
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images. For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the EXACT https:// URLs provided above in img src. NEVER embed base64 data:image — it breaks images! If user asks to embed an inspo image directly, use its {{INSPO_IMAGE_N}} placeholder.]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images (use placeholders like {{CONTENT_IMAGE_0}}). For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the {{CONTENT_IMAGE_N}} placeholders. If user asks to embed an inspo image directly, use its {{INSPO_IMAGE_N}} placeholder.]";
            }
          } else if (inspoImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: These are INSPIRATION images. CLONE THE DESIGN PIXEL-PERFECTLY. Extract exact colors, typography, spacing, layout, button styles, nav style — everything. DO NOT interpret. CLONE EXACTLY what you see. HOWEVER: If user asks to PUT/PLACE/EMBED THIS IMAGE IN THE WEBSITE (not just clone the style), use the {{INSPO_IMAGE_N}} placeholder shown next to that specific image. Each inspo image has its own numbered placeholder — use the one that matches the image the user is referring to.]";
          } else if (contentImgs.length > 0) {
            if (hasUrls) {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images to embed in the website. Use the EXACT https:// URLs provided above in <img src=\"...\">. CRITICAL: NEVER use base64 data:image — only use the https:// URLs!]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images. Use {{CONTENT_IMAGE_N}} placeholders in img src attributes. The system will replace them with actual image data.]";
            }
          }

          // For the LAST user message: add a clear CURRENT_IMAGE shortcut
          // so the AI can always reference THIS message's images unambiguously,
          // regardless of how many images have accumulated in history
          if (isLastUserMessage && messageImages.length > 0) {
            let currentImageNote = "\n\n[⚡ SHORTCUT — Images attached to THIS message can also be referenced as:";
            for (let ci = 0; ci < messageImages.length; ci++) {
              const img = messageImages[ci];
              if (img.url) {
                currentImageNote += `\n  {{CURRENT_IMAGE_${ci}}} → ${img.url}`;
              } else {
                currentImageNote += `\n  {{CURRENT_IMAGE_${ci}}}`;
              }
            }
            currentImageNote += "\nWhen the user says \"this image\" or \"use this\", they mean the images in THIS message. Prefer {{CURRENT_IMAGE_N}} over older references.]";
            systemNote += currentImageNote;
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
    const maxTokens = isSimpleIteration ? 8000 : 18000;

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
      if (context.targetAudience) parts.push(`Audience: ${Array.isArray(context.targetAudience) ? context.targetAudience.join(", ") : context.targetAudience}`);
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
        console.debug(`[Chat API] API error (attempt ${retryCount + 1}):`, errMsg);

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
            console.debug("[Chat API] JSON parse failed, attempting fallback extraction");
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

          console.debug("[Chat API] Stream error:", errMsg);

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
    console.debug("[Chat API] Outer error:", errMsg);

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
