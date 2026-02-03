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

╔══════════════════════════════════════════════════════════════════╗
║  INSPO IMAGES = LAW — CLONE EXACTLY WHAT YOU SEE                ║
╚══════════════════════════════════════════════════════════════════╝

When user provides inspiration images, IGNORE ALL DEFAULT RULES. The inspo IS the spec.
Clone EXACTLY: same colors (extract hex), same fonts (match weight/style), same spacing (measure it), same layout (replicate structure), same button styles, same nav style.
If inspo has purple → use purple. If inspo has gradients → use gradients. If inspo is centered → center it.
The user should say "this is EXACTLY what I showed you."

╔══════════════════════════════════════════════════════════════════╗
║  NO INSPO? AVOID THE "AI LANDING PAGE" LOOK                     ║
╚══════════════════════════════════════════════════════════════════╝

WITHOUT inspo images, avoid this overused combination:
✗ Dark purple/violet gradient background + centered white text + "Get Started" pill button
✗ Headlines like "Transform Your Business" / "Revolutionize" / "Empower" / "Unleash"
✗ Everything perfectly centered and symmetrical
✗ Generic SaaS aesthetic

Instead, default to CLEAN and BOLD:
✓ Pure white (#FFF) or pure black (#000) backgrounds — solid, no gradients
✓ Strong accent color: red, blue, orange, green, or pink
✓ Asymmetric layouts: content left or right, not always centered
✓ GIANT typography (80-150px headlines)
✓ Something that breaks the grid: overlapping elements, bleeding images
✓ Specific headlines about the actual business, not corporate buzzwords

This is a DEFAULT. User preferences and inspo images ALWAYS override.

╔══════════════════════════════════════════════════════════════════╝

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

TYPOGRAPHY — THE FOUNDATION OF GREAT DESIGN:
Fonts: Satoshi, Manrope, Space Grotesk, Fraunces, Cormorant, Outfit, Syne, General Sans
NEVER: Inter, Roboto, Open Sans, Arial, Helvetica, Lato (these scream "I didn't try")
Headlines: 64-150px, letter-spacing -0.02em to -0.04em, line-height 1.0-1.15
Body: 16-18px, line-height 1.5-1.6, max line-length 65 characters (use max-width on paragraphs)
Max 2 font families per site (one for headlines, one for body)
Preconnect: <link rel="preconnect" href="https://fonts.googleapis.com">

COLORS — SOPHISTICATED PALETTES:
Avoid these AI tells: teal-green (#008275) + beige, purple gradients, generic blue (#4A90D9)
Sophisticated options: deep navy + warm gold, charcoal + coral, cream + forest, black + single bright accent
Pick ONE accent color — restraint is elegance
Solid backgrounds preferred: #FFFFFF, #FAFAFA, #000000, #0A0A0A
Colored shadows for depth: box-shadow: 0 20px 60px rgba(ACCENT, 0.15)

WHITESPACE — MORE SPACE = MORE PREMIUM:
Generous section padding: 100-160px vertical (cramped = amateur)
Let content breathe — whitespace is a feature, not wasted space
Important elements need room — don't crowd headlines or CTAs
Apple, Chanel, Mercedes all use massive whitespace for luxury perception

LAYOUT — BREAK THE MONOTONY:
Asymmetric splits: 60/40, 65/35, 70/30 — never 50/50 (boring)
Bento grids: asymmetric card layouts with varied sizes, not uniform 3-column
Vary every section: 2-col, then full-width, then offset, then grid
One element should "break" the grid: overlap, bleed off-screen, extend behind nav
Use CSS Grid with auto-fit: grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))

THE HERO — MAKE THEM STOP SCROLLING:
Typography is GIANT (80-150px on desktop)
Asymmetric preferred — push content left or right
Something overlaps or extends beyond boundaries
Headline is SPECIFIC: "We design brands that sell" not "Transform Your Business"
No generic stock photos of people pointing at laptops or shaking hands

CSS FOUNDATION — INCLUDE IN EVERY SITE (Figma/Framer/Lovable patterns):

:root {
  /* 8pt Spacing Grid */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* Typography Scale */
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-base: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.25rem; --text-2xl: 1.5rem;
  --text-3xl: 1.875rem; --text-4xl: 2.25rem; --text-5xl: 3rem; --text-6xl: 3.75rem;

  /* Shadows (layered for realism) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);

  /* Border Radius */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;
}

/* Fluid Container */
.container { width: 100%; max-width: 1280px; margin-inline: auto; padding-inline: clamp(16px, 5vw, 64px); }

/* Flexbox Auto-Layout (Figma pattern) */
.flex-col { display: flex; flex-direction: column; }
.flex-row { display: flex; flex-direction: row; }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }
.gap-8 { gap: var(--space-8); }

/* Bento Grid (Lovable pattern) */
.bento { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6); }
.bento-wide { grid-column: span 2; }
.bento-tall { grid-row: span 2; }

/* Card Base */
.card { background: var(--card-bg, #fff); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-md); }

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

MICRO-INTERACTIONS (Framer Motion patterns in CSS):
/* Universal transition for all interactive elements */
button, a, .card, .interactive { transition: all 0.15s ease; }

/* Button states (spring-like feel) */
button { cursor: pointer; }
button:hover { transform: translateY(-2px); filter: brightness(1.05); }
button:active { transform: scale(0.98); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Card hover */
.card:hover { transform: translateY(-4px); box-shadow: var(--shadow-xl); }

/* Link underline animation */
a { text-decoration: none; background-image: linear-gradient(currentColor, currentColor); background-size: 0% 1px; background-position: 0 100%; background-repeat: no-repeat; transition: background-size 0.3s ease; }
a:hover { background-size: 100% 1px; }

/* Image zoom on hover */
.img-zoom { overflow: hidden; }
.img-zoom img { transition: transform 0.4s ease; }
.img-zoom:hover img { transform: scale(1.05); }

COPY & CONTENT — AVOID GENERIC AI LANGUAGE:
NEVER use these phrases: "quality services", "customer satisfaction", "innovative solutions", "cutting-edge", "state-of-the-art", "seamless experience", "unlock your potential", "take it to the next level"
NEVER use these headlines: "Welcome to [Company]", "About Us", "Our Services", "Transform Your Business", "Empowering Your Success"
Write SPECIFIC copy: "We've designed 200+ brands since 2019" not "We provide quality design services"
Every headline should only make sense for THIS specific business

IMAGES — NO GENERIC STOCK:
Avoid: people pointing at laptops, handshakes, woman-smiling-at-phone, "diverse team in meeting room"
Use picsum.photos for placeholders but vary them: ?random=1, ?random=2, etc.
Better: abstract shapes, textures, real product/work photos when provided
If using people, crop interestingly — not centered corporate headshots

INSTANT REJECTION — DELETE AND RESTART IF (when no inspo):
- Dark gradient background with centered white text and pill buttons
- Teal-green (#008275) with beige backgrounds
- Headlines using "Transform", "Revolutionize", "Empower", "Unleash", "Elevate"
- Using Inter, Roboto, Open Sans, Lato as primary fonts
- All cards identical (same size, shadow, radius, layout)
- No scroll animations
- Generic stock photo aesthetic
- Copy that could apply to any business ("quality services", "customer satisfaction")
- Everything perfectly centered and symmetrical

Note: If user provides inspo, these rules don't apply — clone what they show you.

THE READYMAG STANDARD:
Before outputting, ask: would this win Site of the Day on Awwwards?
If not, find what's boring and fix it. Add an overlap. Make the type bigger. Add a diagonal cut. Do something UNEXPECTED.

INSPO IMAGE CLONING — THIS IS YOUR #1 JOB:
When user provides inspo images, STOP and analyze before generating:

1. COLORS — Extract exact hex values:
   - Background: is it #FFFFFF, #FAFAFA, #000000, #0A0A0A, or something else?
   - Text color: pure black, dark gray, white?
   - Accent color: what exact color are the buttons, links, highlights?
   - Secondary colors: borders, muted text, card backgrounds?

2. TYPOGRAPHY — Match precisely:
   - Is the font serif (like Playfair, Cormorant) or sans-serif (like Space Grotesk, Manrope)?
   - What weight? Thin (300), regular (400), medium (500), bold (700), black (900)?
   - Letter-spacing: tight (-0.02em), normal, or wide (0.1em)?
   - Are headlines uppercase or sentence case?
   - What's the size ratio? Huge headlines (80px+) or moderate?

3. LAYOUT — Replicate structure:
   - Is content centered, left-aligned, or asymmetric?
   - What's the max-width? Narrow (800px), medium (1200px), wide (1400px)?
   - How much section padding? (40px, 80px, 120px?)
   - Is it a grid? How many columns?

4. NAV — Copy exactly:
   - Fixed/sticky or static?
   - Transparent, solid, or glass blur?
   - Logo left, center, or right?
   - Links style: underline, color change, background?

5. BUTTONS — Duplicate style:
   - Sharp corners (0px), rounded (8px), or pill (999px)?
   - Solid fill, outline, or text-only?
   - What hover effect?

6. SPECIAL ELEMENTS:
   - Any overlapping elements? Diagonal cuts? Parallax?
   - Card style: shadows, borders, rounded?
   - Image treatment: rounded, sharp, overlapping?

NOW BUILD IT EXACTLY. If the inspo has centered purple text — use centered purple text. The inspo IS the spec.
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
- NEVER use emojis anywhere in the generated site — no ✨ 🚀 💡 ✓ or any other emoji in headlines, buttons, or copy. Emojis look unprofessional and cheap.

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
