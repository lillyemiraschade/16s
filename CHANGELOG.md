# 16s Changelog

## [2026-02-05 04:45] — Prompt: Remove duplicate TECHNICAL/FONTS sections + compress ACCESSIBILITY (~350 tokens saved)

**What:** Removed the TECHNICAL section (6 lines) from HTML GENERATION RULES — all items (semantic HTML, WCAG, touch targets, lazy loading, preconnect) were already in ACCESSIBILITY REQUIREMENTS. Removed the FONTS section (4 lines) — font lists were already in TYPOGRAPHY SYSTEM. Compressed ACCESSIBILITY REQUIREMENTS from 12 lines (header + 7 ✓ bullets) to 2 lines, merging the unique items from TECHNICAL (lazy-load, preconnect, mobile-first). Renamed to "ACCESSIBILITY + TECHNICAL REQUIREMENTS".
**Why:** Three sections were teaching the same things. The font list appeared identically in two places. Consolidating removes ~20 lines of pure duplication. System prompt now ~5.9K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 04:40] — Code: Remove dead isReactCode + htmlToReactComponent exports from react-preview.ts

**What:** Removed two unused exported functions from `src/lib/react-preview.ts`: `isReactCode()` (React pattern detection, 12 lines) and `htmlToReactComponent()` (HTML-to-React converter, 38 lines). Neither is imported anywhere in the codebase. Only `createReactPreviewHtml()` is used.
**Why:** `isReactCode` was previously imported in PreviewPanel but removed in R2-39. `htmlToReactComponent` was never imported. Dead code wastes bytes, adds maintenance surface, and misleads readers.
**Files:** src/lib/react-preview.ts
**Type:** code

## [2026-02-05 04:35] — Feature: Add aria-live to toast notifications for screen reader announcements

**What:** Added `role="status"` + `aria-live="polite"` to the "Copied to clipboard" toast in PreviewPanel. Added `role="alert"` to the welcome screen error toast in page.tsx. Both notifications were previously invisible to screen readers.
**Why:** Dynamic status messages (copy confirmations, error alerts) need ARIA live regions to be announced by screen readers. `role="alert"` for errors (immediate announcement), `role="status"` + `aria-live="polite"` for non-urgent confirmations (announced after current speech).
**Files:** src/components/preview/PreviewPanel.tsx, src/app/page.tsx
**Type:** feature

## [2026-02-05 04:30] — Prompt: Compress LAYOUT + COMPONENT PATTERNS (~450 tokens saved)

**What:** Compressed LAYOUT PATTERNS from 27 lines (4 sub-sections with ✓ bullets) to 4 single-line specifications. Compressed COMPONENT PATTERNS from 28 lines (4 sub-sections with ✓ bullets) to 4 single-line specifications. All specific values (grid column counts, shadow values, padding specs, radius options) preserved exactly.
**Why:** These sections used multi-line ✓ bullet format for simple CSS reference values. Single-line format retains all specifics while cutting ~40 lines. System prompt now ~6.3K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 04:25] — Code: Remove unused compressForContent import from ChatPanel

**What:** Removed unused `compressForContent` import from ChatPanel.tsx. The function is imported from `@/lib/images` but never called in this component (only used in page.tsx).
**Why:** Dead imports waste bytes, mislead readers, and can trigger linter warnings. Continuing the dead import cleanup from R2-48 (useMemo) and R2-39 (isReactCode).
**Files:** src/components/chat/ChatPanel.tsx
**Type:** code

## [2026-02-05 04:20] — Feature: Add "Copy URL" button to deployed site link in export menu

**What:** Added a Copy icon button next to the deployed site URL in the export dropdown. Clicking it copies the full deploy URL to clipboard and shows the existing "Copied!" toast. The deployed link now lives in a flex row with the copy button alongside it.
**Why:** After deploying, users often want to share the URL. Previously they had to manually select and copy the URL from the link text. The copy button provides a one-click sharing workflow.
**Files:** src/components/preview/PreviewPanel.tsx
**Type:** feature

## [2026-02-05 04:15] — Prompt: Compress SPACING + MOTION systems (~350 tokens saved)

**What:** Compressed SPACING SYSTEM from 16 lines (2 sub-sections with ✓ bullets + reference line) to 1 line. Compressed MOTION SYSTEM from 18 lines (3 sub-sections with ✓ bullets) to 3 lines. Both sections used verbose multi-line formatting for simple reference values that fit naturally on single lines.
**Why:** These reference tables (padding ranges, gap sizes, duration ranges, scroll animation values) are lookup values, not instructional content. Single-line format is equally effective for the model. System prompt now ~6.7K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 04:10] — Code: Downgrade last 4 client-side lib console.error to debug

**What:** Downgraded 4 remaining client-side `console.error` calls to `console.debug` in lib hooks and utilities: useProjects.ts (2: migration + project list), useDeployment.ts (1: fetch deployments), images.ts (1: image processing). All errors are handled via UI callbacks (`onError`, `setLoading`).
**Why:** Completes client-side console cleanup across ALL client-facing code. Only server-side API routes retain `console.error` (appropriate for server logging). Browser console is now clean for end users.
**Files:** src/lib/hooks/useProjects.ts, src/lib/hooks/useDeployment.ts, src/lib/images.ts
**Type:** code

## [2026-02-05 04:05] — Feature: Add ARIA menu pattern to export dropdown in PreviewPanel

**What:** Added `aria-label="Export options"`, `aria-haspopup="true"`, and `aria-expanded` to the export dropdown trigger button. Added `role="menu"` to the dropdown container. Added `role="menuitem"` to all 4 menu items (Download HTML, Copy to Clipboard, Open in New Tab, Deploy to Web).
**Why:** The export dropdown was missing the ARIA menu pattern, making it invisible to screen readers as a menu widget. Consistent with the UserMenu dropdown fix in R2-47.
**Files:** src/components/preview/PreviewPanel.tsx
**Type:** feature

## [2026-02-05 04:00] — Prompt: Compress PROFESSIONAL TYPOGRAPHY SYSTEM (~350 tokens saved)

**What:** Compressed the typography system from 36 lines (5 sub-sections with ✓ bullets) to 5 single-line specifications. Removed the FLUID TYPOGRAPHY clamp values that duplicated the :root --text-xs through --text-5xl CSS variables already in CSS FOUNDATION. Merged letter spacing, line height, and font weight into pipe-separated single lines.
**Why:** The fluid typography clamp values were listed twice — once in the typography section and once in the CSS :root variables. The per-context reference tables (letter spacing, line height, weights) used multi-line ✓ bullets for what are simple lookup values. System prompt now ~7.0K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 03:55] — Code: Downgrade 8 page.tsx console.error statements to debug

**What:** Downgraded all 8 remaining `console.error` calls in page.tsx to `console.debug`. Covered: API response parse fallback, auth callback errors, autosave failures, beforeunload save, blob upload failures (2), and send message errors (2). All errors are already handled via UI state — fallback messages, `setWelcomeError()`, image fallback objects, and message removal.
**Why:** Completes the client-side console cleanup started in R2-48 (AuthModal/AuthContext), R2-51 (VoiceCall/ChatPanel). All client-facing components now use `console.debug` for diagnostics, keeping the browser console clean for end users while preserving logs for developers.
**Files:** src/app/page.tsx
**Type:** code

## [2026-02-05 03:50] — Feature: Add password visibility toggle to AuthModal

**What:** Added Eye/EyeOff toggle button to the password input in AuthModal. Toggles between `type="password"` and `type="text"`. Button has `aria-label` ("Show password"/"Hide password"), `tabIndex={-1}` to skip in tab order, and resets when switching between sign-in/sign-up modes.
**Why:** Users can't verify their password is typed correctly without trial-and-error. The eye toggle is a standard UX pattern for auth forms that reduces friction and login failures.
**Files:** src/components/auth/AuthModal.tsx
**Type:** feature

## [2026-02-05 03:45] — Prompt: Merge QUALITY BENCHMARKS into PRE-OUTPUT QUALITY CHECK (~150 tokens saved)

**What:** Removed the standalone QUALITY BENCHMARKS section (12 lines including headers) that asked 6 design tests (typography, color, spacing, motion, composition, details) + "Would a senior designer believe a human made this?" Merged the 6 tests as compact checks into the PRE-OUTPUT QUALITY CHECK's ALWAYS line, which already asked the same senior-designer question.
**Why:** Two sections asked the same final question and performed overlapping quality validation. The design tests are more effective when combined with the functional checks in the pre-output pass, not as a separate section. System prompt now ~7.3K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 03:40] — Code: Downgrade remaining client-side console.error/warn to debug

**What:** Downgraded 8 client-side `console.error`/`console.warn` statements to `console.debug` across VoiceCall.tsx (7) and ChatPanel.tsx (1). All errors are already handled via UI state — `setErrorMessage()`, `speak()` fallback, `handleImageError()`. The debug-level logs remain available in DevTools for developers but won't clutter the browser console for end users.
**Why:** Consistent with R2-33 (route.ts) and R2-48 (AuthModal/AuthContext). Client-side console.error/warn for voice recognition, speech synthesis, and background removal are diagnostic details that duplicate the user-facing error handling already in place.
**Files:** src/components/chat/VoiceCall.tsx, src/components/chat/ChatPanel.tsx
**Type:** code

## [2026-02-05 03:35] — Feature: Disable viewport buttons when no preview exists

**What:** Added `disabled={!html}` to the viewport toggle buttons (desktop/tablet/mobile) in PreviewPanel. When no preview HTML exists yet, buttons show at 50% opacity with `cursor-not-allowed` and tooltip says "Generate a website first". ARIA labels include "(disabled)" state.
**Why:** Clicking viewport toggles before generating a website does nothing but confuses users. Disabling them with a helpful tooltip prevents confusion and improves first-run UX.
**Files:** src/components/preview/PreviewPanel.tsx
**Type:** feature

## [2026-02-05 03:30] — Prompt: Compress PROFESSIONAL COLOR SYSTEM section (~250 tokens saved)

**What:** Compressed the color system from 25 lines to 7 lines. Merged dark mode (5 bullet points), light mode (5 bullet points), and accent colors (5 industry lines) into 3 single-line specifications using slash-separated hex values and pipe-separated industry groups. All hex values preserved exactly.
**Why:** The multi-line ✓ bullet format used excessive vertical space for what are essentially reference tables. Single-line format with clear separators retains all the specific hex values while cutting 18 lines. System prompt now ~7.5K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 03:25] — Code: Remove unused useMemo import + downgrade OAuth console.errors to debug

**What:** Removed unused `useMemo` import from page.tsx (imported but never called). Downgraded 3 client-side `console.error` calls in AuthModal.tsx and AuthContext.tsx to `console.debug` — these log OAuth error details to the browser console where end users could see them. The errors are already surfaced in the UI via `setError()`.
**Why:** Dead imports waste bytes and mislead readers. Client-side console.error for OAuth flows leaks error details that are already shown in the UI. Consistent with R2-33 which downgraded diagnostic console.logs in route.ts.
**Files:** src/app/page.tsx, src/components/auth/AuthModal.tsx, src/lib/auth/AuthContext.tsx
**Type:** code

## [2026-02-05 03:15] — Feature: Add a11y to VoiceCall hangup button + UserMenu dropdown roles

**What:** Added `aria-label="End call"` to the VoiceCall hangup button (had `title` but no `aria-label`). Added `role="menu"` to the UserMenu dropdown container and `role="menuitem"` to the sign out button, completing the ARIA menu pattern alongside the existing `aria-haspopup="true"` on the trigger.
**Why:** The hangup button was the last interactive button missing an aria-label. The UserMenu dropdown had `aria-haspopup="true"` on its trigger but never declared the actual menu/menuitem roles, which screen readers need to announce the dropdown as a menu widget.
**Files:** src/components/chat/VoiceCall.tsx, src/components/auth/UserMenu.tsx
**Type:** feature

## [2026-02-05 03:05] — Prompt: Compress PHASE 3 QUALITY CHECK section (~550 tokens saved)

**What:** Compressed the PHASE 3 QUALITY CHECK from ~85 lines to ~15 lines. Combined VISUAL VERIFICATION (8 lines) and IMAGE VERIFICATION (19 lines) into a single 4-line block. Compressed the INTERNAL QA CHECKLIST from checkbox-per-line to a single line with □ separators. Replaced the 18-line QA report JSON example with a compact 1-line schema reference. Merged the QA STATUS definitions and important notes into 1 line.
**Why:** The full JSON example was teaching the format that the model already knows from the response schema. The image debugging CSS issues list (6 bullets) was useful but overly verbose — a single line listing common causes is sufficient for the model to check. The visual verification questions (5 lines) overlapped with the QA checklist items. Prompt now ~7.8K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 03:00] — Code: Extract getUserFriendlyError helper — deduplicate error mapping

**What:** Extracted a shared `getUserFriendlyError(errMsg)` helper function that maps API/stream error messages to user-friendly messages with HTTP status codes. Replaced the two duplicate if/else chains in the stream error handler and outer catch block with single calls to this helper. Also unified inconsistent wording between the two handlers (e.g., "Request timed out" vs "The request timed out").
**Why:** Both error handlers had ~12 lines of identical pattern matching logic mapping error types (overloaded, rate limit, timeout, etc.) to user messages. The helper centralizes this in one place, making it easier to add new error types or change messages. Net reduction: ~20 lines.
**Files:** src/app/api/chat/route.ts
**Type:** code

## [2026-02-05 02:55] — Feature: Add a11y + Escape key handler to AuthModal

**What:** Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="auth-modal-title"` to the modal container. Added `id="auth-modal-title"` to the h2 heading. Added `aria-label="Close"` to the close button. Added `aria-label` to email and password inputs (which only had placeholders). Added Escape key handler to dismiss the modal.
**Why:** AuthModal was missing all standard dialog ARIA attributes and keyboard dismiss. Screen readers couldn't identify it as a modal dialog, and keyboard users couldn't close it with Escape. The email/password inputs relied on placeholder text only, which isn't accessible to screen readers. Consistent with the a11y patterns already applied to the bookmark dialog, call disclaimer modal, and lightbox.
**Files:** src/components/auth/AuthModal.tsx
**Type:** feature

## [2026-02-05 02:50] — Prompt: Compress FUNCTIONALITY STANDARD section (~350 tokens saved)

**What:** Compressed the FUNCTIONALITY STANDARD intro from 6 motivational lines to 1 line, and the 6 UNIVERSAL FUNCTIONALITY REQUIREMENTS blocks from 42 lines of bulleted lists to 6 compact single-line summaries. All key requirements preserved: form validation/persistence, smooth navigation, realistic content, interactive elements, localStorage persistence, and feedback states.
**Why:** The 6 blocks had significant overlap with the JAVASCRIPT PATTERNS section (which already specifies form handling, page routing, mobile menu, tabs, accordion, lightbox, cart patterns). The compact format conveys the same requirements. Prompt now ~8.3K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 02:45] — Code: Add missing aria-labels to ChatPanel + PreviewPanel buttons

**What:** Added `aria-label` to Call button, New Project button, and Edit Message button in ChatPanel. Added `aria-label` to Close History button and two Remove Bookmark buttons in PreviewPanel. Also added `focus-visible:opacity-100` to the Edit Message button so keyboard users can see it (previously only visible on mouse hover).
**Why:** The accessibility audit found these interactive buttons had only `title` attributes (tooltip only) without `aria-label` (needed for screen readers). The Edit Message button was invisible to keyboard users due to `opacity-0 group-hover:opacity-100` without a `focus-visible` counterpart.
**Files:** src/components/chat/ChatPanel.tsx, src/components/preview/PreviewPanel.tsx
**Type:** code

## [2026-02-05 02:40] — Feature: Add a11y + Escape key handler to UserMenu dropdown

**What:** Added Escape key handler to close the user menu dropdown, added `aria-label="User menu"`, `aria-expanded`, `aria-haspopup="true"` to the dropdown toggle button, and added `focus-visible:ring` styling for keyboard navigation. Also optimized the outside-click listener to only attach when the dropdown is open.
**Why:** The dropdown had only an outside-click handler — keyboard users couldn't dismiss it with Escape. The toggle button lacked ARIA attributes needed for screen readers to understand it's a dropdown. The focus-visible ring ensures keyboard users see where focus is.
**Files:** src/components/auth/UserMenu.tsx
**Type:** feature

## [2026-02-05 02:35] — Prompt: Compress industry-specific functionality to single-line summaries (~400 tokens saved)

**What:** Compressed 14 industry-specific functionality blocks from multi-line entries with headings to single-line summaries. Removed blank lines, redundant headers (e.g., "RESTAURANT/CAFE:" → "Restaurant/Cafe:"), and combined bullet points into comma-separated lists. Preserved all key features and the NEVER-invent-content warnings for medical and legal.
**Why:** Each industry had its own 3-5 line block with a heading and bullets — 72 lines total. One-line summaries convey the same information. The model can infer specific features from the compact descriptions. Prompt now ~8.7K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 02:30] — Code: Remove unused errStack variable + unused isReactCode import

**What:** Removed unused `errStack` variable in route.ts outer error handler (leftover from R2-33 stack trace removal) and unused `isReactCode` import in PreviewPanel.tsx.
**Why:** Dead code cleanup — `errStack` was declared but never referenced after R2-33 removed the stack trace logging, and `isReactCode` was imported but never called (only `createReactPreviewHtml` is used).
**Files:** src/app/api/chat/route.ts, src/components/preview/PreviewPanel.tsx
**Type:** code

## [2026-02-05 02:20] — Feature: Compress MANDATORY QUALITY CHECK (~400 tokens saved)

**What:** Compressed the 65-line MANDATORY QUALITY CHECK section to 4 lines. The checklist was heavily redundant with PHASE 3 QA (which already checks accessibility, mobile, forms, links, CLS), the design system (which already mandates 8pt grid, clamp(), font pairing), and the forensic analysis (which already checks layout/color/typography fidelity). Prompt now ~9.1K tokens.
**Why:** Three separate sections were independently checking the same things: emoji ban (already in output rules), button/form/mobile functionality (already in QA phase), font/spacing/color quality (already in design system + forensic analysis). The compressed version retains the key checks without duplicating what other sections enforce.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** feature

## [2026-02-05 02:16] — Prompt: Compress aesthetic direction section (~500 tokens saved)

**What:** Compressed the "NO INSPO?" intro (7 lines of motivational text already covered by the design quality standard), 7 industry aesthetic direction blocks (35 lines × 5 bullet points each) into 7 single-line summaries, and the design system intro (5 lines) into 1 line. Prompt now ~9.5K tokens.
**Why:** The "NO INSPO?" section was redundant with the design quality standard that already says "WITHOUT INSPO: Design something worthy of being inspo." Each industry's aesthetic was 5 bullet points where 1 line captures the key differentiators (layout type, palette, primary CTA, tone). The design system intro repeated the "mandatory" framing already established.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 02:14] — Code: Compress design quality intro + forensic analysis (~350 tokens saved)

**What:** Compressed the DESIGN QUALITY STANDARD intro from 13 lines of motivational text to 1 line ("WITH INSPO: Clone pixel-perfectly. WITHOUT INSPO: Design something worthy of being inspo."). Compressed the forensic analysis from 19 lines to 8 (removed the MICRO-DETAILS and VERIFY subsections, folded their key points into the analysis list). Prompt now ~10K tokens.
**Why:** The motivational preamble ("This is NOT optional", "Holy shit") added no actionable instructions. The micro-details and verify sections repeated points already made in the forensic analysis and the quality gates section later. The core analysis checklist (layout, typography, colors, effects, spacing, inventory) is preserved.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** code

## [2026-02-05 02:12] — Feature: Add blob upload to handleSendMessageInternal for voice call images

**What:** Added content image blob upload logic to `handleSendMessageInternal` (matching the existing logic in `handleSendMessage`). Content images without blob URLs are now uploaded before sending to the API, ensuring the AI receives proper `https://` URLs instead of falling back to `{{CONTENT_IMAGE_N}}` placeholders.
**Why:** `handleSendMessageInternal` is used by the voice call flow (`handleCallComplete`). If a user uploaded content images before starting a call, those images were sent without blob URLs, causing the AI to use placeholder references that needed client-side replacement instead of embedding the URLs directly. This was a known open issue from Round 1.
**Files:** src/app/page.tsx
**Type:** feature

## [2026-02-05 02:10] — Prompt: Compress 8 industry templates to match concise style (~450 tokens saved)

**What:** Compressed the 8 industry-specific functionality templates (Medical, Real Estate, Law Firm, Fitness, Church, Salon, Automotive, Education) from ~80 lines to ~32 lines. Each now has 2-3 lines of key functionality (matching the concise style of the original 6 industries). Removed inline palette/tone descriptions since those are already covered by the AESTHETIC DIRECTION and ACCENT BY INDUSTRY sections.
**Why:** The R2-added templates were 7-10 lines each with palette/tone info that duplicated the design system sections. Claude can infer "law firm = navy/gold, authoritative" from the ACCENT BY INDUSTRY section without it being restated. Prompt now ~10.3K tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 02:08] — Code: Remove stack trace logging + downgrade diagnostic console.logs to debug

**What:** (1) Removed `errStack` variables and stack trace logging from route.ts stream/outer error handlers — only error messages are now logged. (2) Removed AI response text from client-side parse failure log in page.tsx (PII risk). (3) Changed `console.log` → `console.debug` for OAuth flow (AuthContext.tsx), blob upload progress (upload/route.ts), and auth callback success (callback/route.ts). These are diagnostic, not errors.
**Why:** Stack traces in production logs leak internal file paths. AI response text and redirect URLs in logs are unnecessary data exposure. `console.debug` is filtered out in most production log aggregators, reducing noise while keeping the info available for local debugging.
**Files:** src/app/api/chat/route.ts, src/app/page.tsx, src/lib/auth/AuthContext.tsx, src/app/api/upload/route.ts, src/app/auth/callback/route.ts
**Type:** code

## [2026-02-05 02:06] — Feature: Add aria-labels to PreviewPanel toolbar buttons

**What:** Added descriptive `aria-label` to three groups of icon-only buttons in the PreviewPanel toolbar: viewport toggle buttons (Desktop/Tablet/Mobile with active state), code view toggle ("Show/Hide code view"), and code mode toggle ("Switch to React/HTML mode"). These buttons previously only had `title` tooltips.
**Why:** Icon-only buttons need aria-label for screen reader accessibility. `title` is not reliably announced by all screen readers and is a tooltip, not a programmatic name. This completes the aria-label audit across all interactive icon buttons in the app.
**Files:** src/components/preview/PreviewPanel.tsx
**Type:** feature

## [2026-02-05 02:04] — Prompt: Compress conversation flow + placeholder sections (~500 tokens saved)

**What:** Compressed the FLOW FOR WEBSITES (5-step numbered list + example dialogue), FLOW FOR APPS (5 steps), ALWAYS ASK FOR INSPO (6 lines), GENERATE WITH PLACEHOLDERS (11 placeholder examples), and AFTER GENERATION (5 example prompts + 4 IMPORTANT rules) into a single concise CONVERSATION FLOW section plus 2 short paragraphs. All behaviors preserved: call offer, inspo requests, placeholder usage, one-at-a-time content collection. Prompt now ~10.8K tokens.
**Why:** The old sections had verbose example dialogue and duplicated instructions. Claude can follow "ask for ONE piece of content at a time, use pills to skip" without seeing 5 example conversation turns. The 11-item placeholder list was redundant — "[Your Email], [Your Phone], [Image: Hero photo], etc." conveys the same pattern in one line.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 02:02] — Code: Fix variable shadowing + sanitize PII from error logs

**What:** (1) Renamed `uploadedImages` → `uploadedResults` in handleSendMessage's blob upload section to avoid shadowing the state variable of the same name. (2) Removed `console.error` calls that logged raw user messages and AI response text on validation/parse failures in route.ts — replaced with concise error-only messages.
**Why:** The variable shadowing could cause subtle bugs if future code references the wrong `uploadedImages`. The error logging was dumping raw user content and AI responses to server logs, which is a PII risk in production. Error detail (the specific Zod issue) is still logged; raw payloads are not.
**Files:** src/app/page.tsx, src/app/api/chat/route.ts
**Type:** code

## [2026-02-05 02:00] — Feature: Add a11y to bookmark dialog + welcome screen image toggle

**What:** Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="bookmark-dialog-title"` to the bookmark dialog in PreviewPanel.tsx. Added `aria-label` to the image type toggle buttons on the welcome screen in page.tsx (matching the pattern from the ChatPanel fix in R2-7).
**Why:** The bookmark dialog was missing ARIA attributes, meaning screen readers could interact with content behind it. The welcome screen image toggle buttons only had a `title` tooltip but no aria-label — the ChatPanel ones were fixed in R2-7 but the welcome screen instance was missed.
**Files:** src/components/preview/PreviewPanel.tsx, src/app/page.tsx
**Type:** feature

## [2026-02-05 01:47] — Prompt: Remove duplicate VISUAL SELF-REVIEW section (~170 tokens saved)

**What:** Removed the 15-line VISUAL SELF-REVIEW section (lines 337-354) which was a duplicate of the PHASE 3 visual verification section (lines 232-259). Both said the same things: look at the screenshot, verify work, don't trust HTML alone, point out issues even if user says "looks great."
**Why:** Pure duplication. The PHASE 3 section already covers visual verification in detail. Prompt now ~11,316 tokens.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:45] — Code: Upgrade AI models to Sonnet 4.5 + Haiku 4.5

**What:** Upgraded both AI models: Sonnet from `claude-sonnet-4-20250514` to `claude-sonnet-4-5-20250929` (chat + voice routes) and Haiku from `claude-3-5-haiku-20241022` to `claude-haiku-4-5-20251001` (simple iterations). These are the latest available model versions.
**Why:** Sonnet 4.5 and Haiku 4.5 offer improved code generation, better instruction following, and higher quality HTML/CSS output. The previous models were 6+ months old.
**Files:** src/app/api/chat/route.ts, src/app/api/chat/voice/route.ts
**Type:** code

## [2026-02-05 01:42] — Feature: Add Escape key handlers to edit mode + call disclaimer modal

**What:** Added `onKeyDown` Escape handler to the message edit textarea (cancels editing). Added `useEffect` Escape handler for the call disclaimer modal (dismisses modal). Both follow the same pattern already used for the lightbox image modal.
**Why:** Users expect Escape to close modals and cancel editing. The lightbox already supported Escape, but the edit textarea and call disclaimer didn't. Keyboard-only users had to tab to buttons instead.
**Files:** src/components/chat/ChatPanel.tsx
**Type:** feature

## [2026-02-05 01:40] — Prompt: Compress form example, quality requirements, bg removal (~430 tokens saved)

**What:** (1) Replaced 17-line contact form JavaScript example with reference to JAVASCRIPT PATTERNS #3. (2) Replaced 25-line "Quality Requirements (same as inspo cloning)" section with 1-line reference to DESIGN SYSTEM section — all the same guidance was duplicated there. (3) Compressed background removal from 3 sentences to 1. Prompt now ~11,488 tokens.
**Why:** The contact form code was already described in the compressed JS patterns section. The quality requirements section was a near-perfect duplicate of the Design System section that follows. Removing these saves ~430 tokens and eliminates maintenance drift.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** prompt

## [2026-02-05 01:37] — Code: Deduplicate easing curves + hover states in SYSTEM_PROMPT

**What:** Removed duplicated easing curves (4 lines listing cubic-bezier values that were already defined in :root CSS vars) and hover states section (4 lines listing transforms already in "ALSO INCLUDE" section). Replaced with single-line references to the CSS Foundation section.
**Why:** The easing curves appeared twice — once as text descriptions and once as CSS custom properties. The hover states were listed in full AND summarized elsewhere. Deduplication saves ~50 tokens and prevents drift if values are updated in one place but not the other.
**Files:** src/app/api/chat/route.ts (SYSTEM_PROMPT)
**Type:** code

## [2026-02-05 01:35] — Feature: Add aria-modal + role=dialog to call disclaimer modal

**What:** Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="call-disclaimer-title"` to the voice call disclaimer modal in ChatPanel.tsx. Also added the matching `id` to the h2 heading.
**Why:** The lightbox modal already had `aria-modal="true"` but the call disclaimer modal was missing it, which means screen readers and keyboard users could interact with hidden content behind the modal.
**Files:** src/components/chat/ChatPanel.tsx
**Type:** feature

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
