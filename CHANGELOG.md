# 16s Changelog

## [2026-02-05 01:33] — Prompt: Compress app/tool examples — recipe code + loading animation (~560 tokens saved)

**What:** Replaced the 35-line recipe recommender JavaScript example, 14-line loading animation HTML/CSS, 6-line form interactions checklist, and 5-line data persistence example with 3 lines of concise descriptions. Preserved key specs (30+ item database, matching algorithm, bounce dots with stagger, localStorage with max 20 entries).
**Why:** Claude can write a recipe matching algorithm and bouncing dots animation without seeing full code. These examples were the last remaining full code blocks in the prompt. Prompt now ~11,971 tokens — well under the 13K target.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:30] — Code: Fix rate limit memory leak in 4 API routes

**What:** Added expired-entry cleanup to `checkRateLimit()` in deploy, upload, voice, and remove-bg routes. When map exceeds 500 entries, sweeps all expired ones. The main chat route already had interval-based cleanup.
**Why:** The `rateLimitMap` in these 4 routes grew unbounded — entries were created for every unique IP but never deleted. In production with many unique visitors, this is a slow memory leak. The cleanup triggers only when the map gets large (>500 entries), so it has zero cost for normal traffic.
**Files:** src/app/api/deploy/route.ts, src/app/api/upload/route.ts, src/app/api/chat/voice/route.ts, src/app/api/remove-bg/route.ts
**Type:** code

## [2026-02-05 01:28] — Feature: Fix React output dark-mode bias + verify context persistence

**What:** Fixed React output mode section — component structure example and Tailwind patterns were hardcoded to dark mode (bg-zinc-950, text-zinc-50, border-white/5). Now says "adapt colors to match site palette." Also verified context persistence flow end-to-end: context is correctly defined → saved → sent to API → injected → instructed → returned → merged → loaded. Updated progress.txt to mark all original Round 2 targets as DONE.
**Why:** React output was always generating dark-mode sites regardless of what the user wanted, because the example and patterns section only showed zinc/dark values. Context persistence was listed as needing verification — flow confirmed complete with no gaps.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT), progress.txt
**Type:** feature

## [2026-02-05 01:25] — Prompt: Compress ─── separators + amateur bans section (~700 tokens saved)

**What:** Replaced 18 `─────` separator lines with `---`. Compressed the ABSOLUTE BANS section from 4 subsections (32 lines) into 1 concise list (9 lines) that preserves all key anti-patterns (generic AI colors, cookie-cutter layouts, fake social proof, amateur typography/spacing/motion).
**Why:** The amateur subsections were verbose and overlapped with the professional systems that followed. Each ban item was already countered by a "do this instead" rule later in the prompt. The compressed version hits the same notes in 1/3 the space. Prompt now ~12,529 tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:22] — Code: Replace decorative separators + fix last console.logs (~600 tokens saved)

**What:** Replaced 27 decorative separator lines (═══ and ━━━, 65 chars each) with `---` (3 chars each) in SYSTEM_PROMPT and contextInjection. Changed 2 remaining `console.log` to `console.debug` in credit deduction logic (lines 126, 152).
**Why:** The 27 separator lines wasted ~600 tokens on pure decoration. `---` is equally effective for section delineation. This brings the prompt to ~12,953 tokens — under the 13K target. The console.logs should be debug level since they're diagnostic, not errors.
**Files:** src/app/api/chat/route.ts
**Type:** code

## [2026-02-05 01:19] — Feature: Improve QA report quality — anti-rubber-stamp example

**What:** Replaced the 4-check "all_good" QA report example with a 7-check "minor_notes" example showing realistic checks (visual match, touch targets, form labels, mobile layout, image dimensions, interactive elements). Changed default status guidance so "minor_notes" is most common and "all_good" is rare. Updated example pills from generic ("Try it out!", "Make changes") to contextual ("Add online ordering", "Add customer reviews"). Added instruction to include 6+ checks covering visual, accessibility, functionality, and mobile.
**Why:** The AI was rubber-stamping "all_good" with only 4 shallow checks because the example trained it to do exactly that. By showing a realistic "minor_notes" example with 7 specific checks, the AI will produce more thorough QA reports that actually catch issues.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** feature

## [2026-02-05 01:17] — Prompt: Compress JavaScript patterns from 217 lines to 12

**What:** Replaced the JAVASCRIPT PATTERNS section (217 lines of full JavaScript code blocks for page routing, mobile menu, form handling, smooth scroll, tabs/accordion, lightbox, filter/search, cart, pricing toggle, clipboard, loading dots, and lightbox CSS) with 12 concise one-line descriptions. Each description preserves the key specification (class names, null guards, specific behaviors) without the full implementation.
**Why:** Claude can write these standard JavaScript patterns without seeing full code templates. The 217 lines were ~1400 tokens of unnecessary weight. The compressed version captures the critical details (e.g., "showPage(id) function — fade out all .page elements, show matching one") that ensure consistency without spelling out every line.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:15] — Prompt: Compress component patterns from 230 lines to 12

**What:** Replaced the MODERN COMPONENT PATTERNS section (230 lines of full CSS code blocks for buttons, cards, inputs, badges, nav, hero, animations, gradients, tables, modals) with a 12-line style guide summary. Also fixed dark-mode bias — patterns now say "adapt colors to match site palette" instead of hardcoding zinc values.
**Why:** The full CSS code blocks were the single largest token waste remaining (~1500 tokens). Claude knows how to write CSS for these basic components. The compressed version gives the key design decisions (border-radius values, shadow layering, transition speeds, z-index patterns) without spelling out every CSS property.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:14] — Prompt: Add modern CSS patterns to design system

**What:** Added MODERN CSS PATTERNS section with 7 contemporary techniques: bento grids (varied span sizes), text gradients (background-clip), gradient mesh backgrounds (layered radial-gradient), scroll-driven reveals (IntersectionObserver/animation-timeline), container queries (@container), color-mix() for dynamic opacity, and :has() selector for parent selection.
**Why:** Generated sites were using only basic CSS patterns. Modern websites use bento grids, text gradients, and scroll animations as standard practice. Adding these patterns encourages the AI to produce more contemporary-looking designs.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:13] — Prompt: Add multi-request handling and undo/revert flow

**What:** Added two conversation flow improvements: (1) MULTI-REQUEST HANDLING — when user sends multiple changes in one message, handle all of them and list what changed. (2) UNDO/REVERT REQUESTS — when user says "go back" or "undo", tell them about Cmd+Z for built-in undo, and acknowledge what's being reverted instead of regenerating from scratch.
**Why:** Users frequently send compound requests like "make the header blue and add a footer" and the AI would only address one change. Users also say "go back" expecting the AI to know about the undo feature. Both are common friction points.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:12] — Feature: Complete context persistence — AI can now learn and return preferences

**What:** Added `context` field to ChatResponse (route.ts) so the AI can return learned preferences. Added "CONTEXT LEARNING" instructions to the system prompt telling AI when to include context (first plan response, preference changes). Updated client (page.tsx) to merge returned context into `projectContext` state, which auto-saves with the project and gets injected back into future messages.
**Why:** The context flow was incomplete — the API could *receive* and *inject* context, but the AI had no way to *set* it. Context was only populated from loaded projects, meaning a brand-new conversation would never build up learned preferences. Now the AI returns context when it learns the brand name, industry, colors, etc.
**Files:** src/app/api/chat/route.ts, src/app/page.tsx
**Type:** feature

## [2026-02-05 01:11] — Prompt: Add automotive + education industry templates

**What:** Added AUTOMOTIVE/DEALER/MECHANIC template (vehicle inventory, filtering, test drive CTA, service department, financing, bold palette) and EDUCATION/TUTORING/COURSES template (course catalog, instructor profiles, enrollment CTA, schedule, testimonials, approachable palette). Completes all 6 planned industry templates for Round 2.
**Why:** Automotive and education are common business types that benefit from specific functionality templates (vehicle inventory cards, course catalog). These are the last two industries from the Round 2 target list.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:10] — Code: Remove dead code and excessive console.logs

**What:** Removed dead code in route.ts (lines 2080-2082: `systemPromptText` built but never used). Removed ~25 console.log/warn statements from page.tsx (image replacement, blob upload, autosave), route.ts (request debug, response preview, retry), and projects.ts (save/list/migration). Kept console.error statements for actual errors. Simplified catch blocks where error variable was only used for logging.
**Why:** Production code was logging detailed debug info on every request (raw request keys, message counts, response previews, image replacement progress, blob upload confirmations). This clutters server logs, leaks information, and wastes processing time. Error-level logging is retained for actual failures.
**Files:** src/app/page.tsx, src/app/api/chat/route.ts, src/lib/projects.ts
**Type:** code

## [2026-02-05 01:09] — Feature: Strengthen QA report checklist with specific technical checks

**What:** Replaced vague QA checklist items with specific, verifiable checks: form inputs must have labels (not just placeholders), touch targets >= 44px on mobile, all images need explicit width/height (CLS prevention), external links need target="_blank" rel="noopener". Added anti-rubber-stamp instruction: "Do NOT just say all_good — actually check. Report minor_notes with what you fixed."
**Why:** The AI was generating "all_good" QA reports by default without actually verifying. The new checks are specific enough that the AI can actually fail them, leading to self-correction before outputting HTML. This catches real accessibility and performance issues.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** feature

## [2026-02-05 01:08] — Prompt: Add church/nonprofit + salon/spa templates, compress pixel-perfect checklist

**What:** Added CHURCH/NONPROFIT/MINISTRY template (service times, events, "Plan Your Visit" CTA, sermon archive, giving, ministries, warm palette) and SALON/SPA/BEAUTY template (service menu, "Book Now" CTA, stylist profiles, gallery, gift cards, elegant palette). Removed the PIXEL-PERFECT CHECKLIST section (~30 lines) which duplicated the compressed forensic analysis section and the absolute rules — same "check position, size, shape, color, effects" items.
**Why:** Churches/nonprofits and salons/spas are among the most-requested business types. The pixel-perfect checklist was redundant with the forensic analysis section already covering identical checks. Net token change: roughly neutral (two templates added, redundant checklist removed).
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:07] — Code: Add aria-label to image type toggle button

**What:** Added descriptive `aria-label` to the inspo/content image toggle button in ChatPanel.tsx, including the current state (e.g., "Toggle image 1 type: currently content"). Also confirmed beforeunload save already includes context (line 438 of page.tsx).
**Why:** The toggle button had a visual `title` tooltip but no aria-label for screen readers. This was the last identified missing aria-label on interactive elements in the chat panel.
**Files:** src/components/chat/ChatPanel.tsx
**Type:** code

## [2026-02-05 01:06] — Feature: Add contextual pill suggestions by industry

**What:** Added "CONTEXTUAL PILL SUGGESTIONS" section to the BMAD system instructions that maps industry types to relevant next-step pills (e.g., restaurant → "Add online ordering", law firm → "Add case results", fitness → "Add class schedule"). Includes explicit instruction to never suggest generic pills like "Change colors" after a full build.
**Why:** After generating a restaurant site, the AI would suggest generic pills like "Make changes" instead of industry-relevant features like "Add online ordering." Contextual pills dramatically improve the follow-up UX by suggesting what users actually want next.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** feature

## [2026-02-05 01:05] — Prompt: Add fitness/gym template + compress CSS toolkit

**What:** Added FITNESS/GYM/STUDIO industry template (class schedule, membership tiers, trainer profiles, facility tour, trial offer CTA, energetic palette). Simultaneously compressed the "UNIVERSAL CSS TOOLKIT" section from ~115 lines of basic CSS reference (font weights, backgrounds, shadows, shapes, positioning, spacing, patterns) down to 5 lines of 16s-specific reminders. Claude knows basic CSS — only non-obvious patterns (glowing borders, star particles, z-index layering) were kept.
**Why:** Fitness/gym sites are a top business type with specific needs (class schedules, membership comparison). The CSS toolkit was the single largest token waste in the prompt — ~800 tokens of CSS properties Claude already knows.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:04] — Code: Add html2canvas CORS fallback with allowTaint retry

**What:** Refactored `captureScreenshot` to use a two-tier approach: first try `useCORS: true, allowTaint: false` for a clean exportable canvas, then fallback to `allowTaint: true` which renders all images (including cross-origin) but may produce a tainted canvas. The `toDataURL` call on the tainted canvas is wrapped in its own try/catch so it fails gracefully.
**Why:** Sites with cross-origin images (e.g., from external CDNs) would produce blank screenshots because `allowTaint: false` skips those images entirely. The fallback renders them and attempts export — if the canvas is tainted, it fails silently rather than crashing.
**Files:** src/app/page.tsx
**Type:** code

## [2026-02-05 01:03] — Feature: Improve plan card consistency + first-message intelligence

**What:** Strengthened plan generation instructions: (1) Always show plan for new sites, even simple-sounding ones. (2) Added "FIRST-MESSAGE INTELLIGENCE" rule — when the user's first message includes a clear business type AND name, skip clarifying questions and generate a plan immediately using the matching industry template. (3) Compressed the "when to plan vs skip" section.
**Why:** Users often gave clear requests like "Build a website for Joe's Pizza" and the AI would ask "What kind of website do you want?" instead of detecting the industry and showing a plan. This added unnecessary friction to the most common flow.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** feature

## [2026-02-05 01:02] — Prompt: Add law firm industry template + compress forensic analysis

**What:** Added LAW FIRM/LEGAL industry template (practice areas, attorney profiles, consultation CTA, case results, FAQ, trust signals, navy/gold palette). Simultaneously compressed the verbose forensic analysis checklist (Phases 1-4) from ~120 lines to ~20 lines by removing checklist formatting and CSS property explanations Claude already knows.
**Why:** Law firms are one of the most common business types needing websites but had no template. The forensic analysis section was the most verbose part of the prompt — Claude knows what typography, color extraction, and spacing analysis mean without 60+ checkbox items spelling it out. Net token savings: ~400 tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:01] — Code: Extract shared helpers from handleSendMessage and handleSendMessageInternal

**What:** Extracted two shared helper functions (`buildCleanMessages` and `sendAndProcessChat`) from the duplicated fetch+parse+state-update logic in `handleSendMessage` and `handleSendMessageInternal`. Both functions now call the shared helpers instead of having ~130 lines of identical code. Net reduction: 53 lines.
**Why:** The two message-sending functions had nearly identical fetch, parse, and preview-update logic copied between them. Any bug fix or feature change had to be applied in two places, risking drift. The shared helpers make the code DRY and easier to maintain.
**Files:** src/app/page.tsx
**Type:** code

## [2026-02-05 00:20] — Prompt: Fix null-unsafe Cart and Copy-to-Clipboard JavaScript patterns

**What:** Added null guards to Cart pattern (`document.querySelector('.cart-count')` and `.cart-total` now checked before access, `parseFloat` fallback to 0) and Copy-to-Clipboard pattern (`btn.previousElementSibling?.textContent` with optional chaining, early return if empty).
**Why:** These JavaScript templates are copied into every generated site that uses carts or copy buttons. Without null guards, they throw TypeError if the expected DOM elements are missing, breaking interactivity. Completes the null safety audit across all 10 JS patterns (cycles 6, 16, 20).
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:19] — Performance: Truncate preview HTML client-side before sending to API

**What:** Added client-side truncation of `currentPreview` to 30K characters before including it in the API request body, matching the server-side truncation limit. Applied to both `handleSendMessage` and `handleSendMessageInternal`.
**Why:** The server already truncates `currentPreview` to 15K-30K chars for context injection, but the client was sending the full HTML (up to 500K chars) in every request. For sites with large HTML, this wasted bandwidth and increased request parsing time. Truncating client-side saves up to ~470KB per request.
**Files:** src/app/page.tsx
**Type:** performance

## [2026-02-05 00:18] — Prompt: Deduplicate spacing values and fix missing --space-32

**What:** Removed the duplicated 5-line spacing scale from the PROFESSIONAL SPACING SYSTEM section (it was identical to the :root CSS variables in CSS FOUNDATION) and replaced with a reference. Also added missing `--space-32: 128px` to the :root block which was only in the now-removed duplicate.
**Why:** The same 12 spacing values were listed twice in the prompt (~150 tokens wasted). Consolidating to one canonical location (:root) eliminates the risk of them diverging and saves tokens per request.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:17] — Security: Add rate limiting to deploy route

**What:** Added per-IP in-memory rate limiting (5 req/min) to `/api/deploy` POST handler, matching the pattern used on other routes.
**Why:** The deploy route creates real Vercel deployments that consume API quota and infrastructure resources. While it requires authentication, an authenticated user (or compromised session) could spam deployments without any throttling.
**Files:** src/app/api/deploy/route.ts
**Type:** security

## [2026-02-05 00:16] — Prompt: Fix null-unsafe Tabs/Accordion JavaScript patterns

**What:** Added null checks to the Tabs and Accordion JavaScript templates in the system prompt. Tabs: guard `btn.closest('.tabs')` and `document.getElementById(btn.dataset.tab)`. Accordion: guard `header.parentElement`, `item.closest('.accordion')`, and `i.querySelector('.accordion-content')`.
**Why:** These patterns are copied verbatim into generated sites. Without null guards, they throw TypeError when elements are missing (e.g., due to layout variations or partial DOM). This is the same class of bug fixed in cycle 6 for patterns 1-3, now extended to pattern 5.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:15] — Bug: Fix migration data loss on partial cloud save failure

**What:** Fixed `migrateLocalToCloud` clearing ALL localStorage projects even when only some were successfully migrated to Supabase. Now tracks which projects succeeded via a Set of IDs and only removes those from localStorage, preserving any that failed to migrate.
**Why:** If 5 local projects existed but only 3 migrated successfully (e.g., due to network errors), the remaining 2 were permanently deleted from localStorage. Users signing in for the first time could silently lose projects.
**Files:** src/lib/projects.ts
**Type:** bug

## [2026-02-05 00:14] — Prompt: Unify contradictory font recommendations

**What:** Merged two contradictory font lists (lines 1023-1024 recommended Satoshi/Cabinet Grotesk/Clash Display/Söhne, line 1395 recommended a different set) into one consistent recommendation of Google Fonts-available fonts. Display: Syne, Space Grotesk, Outfit, Fraunces, Playfair Display. Body: Inter, Manrope, Plus Jakarta Sans, DM Sans, Source Sans 3.
**Why:** The old recommendations included fonts NOT available on Google Fonts (Satoshi, Cabinet Grotesk, Clash Display, Söhne) despite the prompt telling Claude to use Google Fonts preconnect. This caused generated sites to have 404 font loads and fall back to system fonts, making designs look wrong.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:13] — Security: Add rate limiting to voice API route

**What:** Added per-IP in-memory rate limiting (30 req/min) to `/api/chat/voice` endpoint, matching the pattern used on upload and remove-bg routes.
**Why:** The voice route uses the expensive Claude Sonnet model and had zero abuse protection — anyone could call it unlimited times. The 30 req/min limit is generous enough for real voice calls (which need fast back-and-forth) while preventing automated abuse.
**Files:** src/app/api/chat/voice/route.ts
**Type:** security

## [2026-02-05 00:12] — Prompt: Compress CSS Foundation boilerplate into shorthand

**What:** Replaced 35 lines of full CSS rules (container, reveal animations, stagger, reduced motion, hover interactions, focus-visible, skip-link, IntersectionObserver) with a 6-line shorthand summary that references the :root variables. Kept all specific values (translateY amounts, stagger delays, threshold) but removed boilerplate CSS Claude already knows how to write.
**Why:** Claude knows basic CSS patterns like containers, hover effects, and focus-visible outlines — spelling them out in full CSS wastes ~400 tokens per request. The shorthand preserves the specific 16s design values while trusting the model's CSS knowledge.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:11] — Security: Add server-side payload size validation to upload routes

**What:** Added payload size validation to `/api/upload` (5MB limit) and `/api/remove-bg` (10MB limit) with both Content-Length header pre-check and post-parse data length check. Also added `typeof` validation on `imageData` to prevent non-string payloads.
**Why:** Both routes previously accepted arbitrarily large payloads — the frontend compresses images but an attacker bypassing the frontend could POST massive base64 strings to exhaust serverless function memory. The dual check (header + data length) catches both honest and spoofed requests.
**Files:** src/app/api/upload/route.ts, src/app/api/remove-bg/route.ts
**Type:** security

## [2026-02-05 00:10] — Prompt: Consolidate redundant image handling instructions

**What:** Replaced 25 lines of repetitive, partially contradictory image embedding instructions (3 separate "how to embed" explanations, 6 "FORBIDDEN" lines, duplicate URL rules) with a single 10-line section that clearly states the one rule: follow the system's per-image instruction (URL or placeholder), never write base64.
**Why:** The old section had evolved organically as image handling changed, leaving overlapping instructions that confused the model and wasted ~350 tokens per request. The consolidated version is clearer and saves tokens on every API call.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:09] — UX: Fix Cmd+Z/Cmd+Shift+Z hijacking text undo in inputs

**What:** Added `document.activeElement` tag checks to the keyboard shortcut handler so that Cmd+Z (undo) and Cmd+Shift+Z (redo) are only intercepted for preview version history when focus is NOT in an input or textarea. When the user is typing, native browser undo/redo now works normally.
**Why:** Previously, pressing Cmd+Z while typing in the chat input or any textarea would undo the preview instead of undoing text — a frustrating UX bug that broke basic text editing expectations.
**Files:** src/app/page.tsx
**Type:** ux

## [2026-02-05 00:01] — Performance: Upgrade simple iteration model to Claude 3.5 Haiku

**What:** Upgraded the model used for simple iterations (color changes, text tweaks, small adjustments) from `claude-3-haiku-20240307` to `claude-3-5-haiku-20241022`.
**Why:** Claude 3.5 Haiku has significantly better JSON format adherence and HTML/CSS generation quality while maintaining the speed needed for quick iterations, improving reliability of simple change requests.
**Files:** src/app/api/chat/route.ts
**Type:** performance

## [2026-02-05 00:02] — Prompt: Add medical/dental and real estate industry templates

**What:** Added industry-specific generation rules for medical/dental/health clinics (appointment forms, provider profiles, insurance sections, professional tone) and real estate (property listings, filters, agent profiles, mortgage CTAs), with corresponding design direction for each.
**Why:** Medical practices and real estate are among the most common business types requesting websites, but previously got generic output with no relevant functionality like appointment booking or property filtering.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:03] — Security: Fix credit deduction race condition

**What:** Fixed TOCTOU race condition in `checkAndDeductCredits` where two concurrent requests could read the same credit balance and both succeed, effectively double-spending. Now uses optimistic concurrency control (conditional update with retry) to ensure atomic deduction. Also made usage logging non-blocking.
**Why:** Concurrent requests from the same user could bypass credit limits, causing billing discrepancies. The fix ensures credits are deducted atomically without requiring database schema changes.
**Files:** src/app/api/chat/route.ts
**Type:** security

## [2026-02-05 00:04] — Prompt: Add subjective feedback interpretation guide

**What:** Added a "SUBJECTIVE FEEDBACK — ACT, DON'T ASK" section to the system prompt that maps common vague user phrases ("make it pop", "too boring", "more professional", "I don't like it") to concrete design actions the AI should take immediately.
**Why:** Users commonly give vague aesthetic feedback and the AI would either ask clarifying questions (adding friction) or make minimal changes. Now the AI will interpret and execute bold changes immediately, matching how a real designer would respond to a client.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:05] — UX: Restore uploaded images on request failure

**What:** When a chat request fails (network error, API overload, timeout), uploaded images are now restored to the upload area instead of being silently lost.
**Why:** Previously, images were cleared from state before the API call, so if the request failed, users had to re-upload all their images. This was especially frustrating with large or multiple images.
**Files:** src/app/page.tsx
**Type:** ux

## [2026-02-05 00:06] — Prompt: Fix null-unsafe JavaScript patterns in system prompt

**What:** Added null checks to the JavaScript patterns (showPage, mobile menu, form handling) that the AI copies into every generated site. `showPage()` now guards against missing page elements, mobile menu checks element existence before adding listeners, and form handler falls back to any button if no `[type="submit"]` exists.
**Why:** Generated sites would throw runtime errors (TypeError: Cannot read properties of null) if any expected element was missing due to layout variations, causing broken interactivity in the live preview.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 00:07] — Security: Add rate limiting to upload and remove-bg routes

**What:** Added per-IP in-memory rate limiting to `/api/upload` (15 req/min) and `/api/remove-bg` (5 req/min) endpoints which previously had zero abuse protection.
**Why:** Both routes consume paid resources (Vercel Blob storage and remove.bg API credits) and were completely unprotected — anyone could call them unlimited times. The remove-bg route is especially critical since each call costs money on the external API.
**Files:** src/app/api/upload/route.ts, src/app/api/remove-bg/route.ts
**Type:** security

## [2026-02-05 00:08] — Prompt: Deduplicate emoji ban rule to save ~200 tokens per request

**What:** Consolidated the "no emojis" rule from 5+ separate mentions (including a full emoji character scan list) down to 2: the initial declaration in the personality section and the quality gate checklist. Removed ~200 tokens of redundancy.
**Why:** Every token in the system prompt costs money on every request across all users. The emoji ban was stated 5 times in different sections with the same message. Two strong mentions (one to set the rule, one to verify) is sufficient.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt
