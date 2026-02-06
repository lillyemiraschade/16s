# 16s Changelog

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
