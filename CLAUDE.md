# 16s — Round 9: Architecture, Polish & Features

## What 16s Is
AI web builder. Users describe a website, AI builds it. Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob, Vercel hosting. Live at 16s-ruddy.vercel.app.

## What Rounds 1-8 Did
- Rounds 1-7: 156 changes — mostly prompt compression (50), code cleanup (45), features (35), security (12)
- Round 8: Runtime pen testing — verified all endpoints, headers, auth, RLS with real curl commands

## What This Round Does
Architecture cleanup, real feature additions, output quality improvements, and app UI polish. Every change must either (a) make the codebase more maintainable, (b) make the user experience better, or (c) make the AI output higher quality.

## Commands
```
npm run build          # Must pass after every change
npm run dev            # Dev server (start with: npm run dev > /dev/null 2>&1 &)
npx tsc --noEmit       # Type check
```

## Commit Rules
- Prefix: [Ralph R9-N] where N is the cycle number
- One logical change per commit
- npm run build must pass before committing
- If build fails, fix before moving on

## BANNED (already done in prior rounds)
- Prompt compression or restructuring
- Removing dead code or unused imports
- Downgrading console.error to console.debug
- Adding aria-labels, focus traps, escape handlers
- Adding keyboard shortcuts
- Extracting small helper functions

## PRIORITY ORDER (work through top to bottom)

### P0 — ARCHITECTURE (cycles 1-8)
These are structural problems that make the codebase harder to maintain.

1. **RATE LIMITER DEDUP**: The exact same rate limiter is copy-pasted 7 times across routes. Extract to src/lib/rate-limit.ts:
   ```typescript
   export function createRateLimiter(limit: number, windowMs: number = 60_000) {
     const map = new Map<string, { count: number; resetAt: number }>();
     return {
       check(ip: string): boolean { ... },
       cleanup() { ... }
     };
   }
   ```
   Then replace all 7 copies. Import and use: `const limiter = createRateLimiter(20);`

2. **GOD COMPONENT SPLIT**: page.tsx is 1741 lines with 27 useState hooks. Split into:
   - src/lib/hooks/useChat.ts — message state, send logic, pill handling, stop generation, edit message
   - src/lib/hooks/usePreview.ts — preview state, history, undo/redo, bookmarks, viewport
   - src/lib/hooks/useImages.ts — image upload, remove, type toggle, bg removal, blob URLs
   - src/lib/hooks/useWelcome.ts — welcome screen state, headline rotation, idea pool, welcome input
   - page.tsx becomes ~400 lines of composition: hooks + layout + render

   IMPORTANT: Don't break any functionality. The hooks just move state and handlers out of page.tsx. All the same props get passed to ChatPanel and PreviewPanel.

3. **SYSTEM PROMPT EXTRACTION**: Move the 372-line SYSTEM_PROMPT and 63-line REACT_ADDENDUM from route.ts to src/lib/ai/prompts.ts. Route.ts should import them. This makes the prompt editable without touching API logic.

4. **CLEAN UP _bmad FOLDER**: The _bmad/ directory contains planning templates that aren't used by the app. Move to docs/_bmad/ or delete. Same with SMARTER_16S_PLAN.md and ROADMAP.md — consolidate into one docs/ROADMAP.md.

5. **ENV VALIDATION**: Add src/lib/env.ts that validates required env vars at startup and provides typed access:
   ```typescript
   export const env = {
     anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
     supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
     // ... etc, with optional ones clearly marked
   };
   ```

6. **ERROR HANDLING CONSISTENCY**: Some routes return `Response()`, others `NextResponse.json()`. Standardize all routes to use a shared `apiError(message, status)` and `apiSuccess(data)` helper from src/lib/api-utils.ts.

7. **TYPES CLEANUP**: types.ts is lean but missing some types that are defined inline in components (ChatPanelProps has 17 props — this interface should be in types.ts and imported). Also add a ChatAPIResponse type that matches what route.ts actually returns.

8. **GLOBALS.CSS AUDIT**: 274 lines. Check for unused styles, duplicate declarations, styles that could be Tailwind classes. The welcome-bg, sidebar gradients, and custom scrollbar styles should stay. Remove anything dead.

### P1 — APP UI IMPROVEMENTS (cycles 9-16)
These improve the 16s interface itself (not the output websites).

9. **WELCOME SCREEN POLISH**: The welcome screen is functional but plain. Improve:
   - Subtle animated gradient or grain texture on the background
   - Better visual hierarchy on the headline
   - Idea pills should have slight hover animations
   - The input area should feel more premium (subtle glow on focus, better placeholder)

10. **CHAT PANEL POLISH**:
    - Messages should have slightly better typography (line-height, letter-spacing on AI messages)
    - The pill buttons after AI responses need better visual design — currently basic rounded buttons
    - Image upload thumbnails should be slightly larger and have better hover states
    - Plan cards (BMad planning phase) need visual polish — currently they look like debug output
    - QA report cards need visual polish — make pass/fail checks feel polished, not clinical

11. **PREVIEW PANEL IMPROVEMENTS**:
    - The generating state animation should feel more premium
    - Version history dropdown should show preview thumbnails if possible (or at least timestamps)
    - The toolbar should be more compact and better organized
    - The deploy success state should be more celebratory (this is a big moment for users)

12. **PROJECTS PAGE**: Currently basic list view. Add:
    - Preview thumbnails for each project (store a small screenshot on save)
    - Better empty state for new users
    - Project cards instead of list items
    - Last edited time relative ("2 hours ago" not "Feb 5, 2025")

13. **RESPONSIVE IMPROVEMENTS**: Test at 375px (iPhone SE):
    - Chat and preview should stack vertically on mobile
    - The toolbar should collapse appropriately
    - Touch targets should all be 44px+
    - No horizontal scroll anywhere

14. **LOADING STATES**: Every async operation needs a good loading state:
    - Initial page load (LoadingSkeleton exists, verify it's used)
    - Project loading from cloud
    - Image upload progress
    - Deploy in progress
    - AI response streaming (typing indicator exists, make sure it looks good)

15. **ERROR STATES**: When things go wrong, users should see helpful messages:
    - Network error during generation → "Connection lost. Your project is safe. Try again."
    - Image upload fails → specific error message
    - Deploy fails → show what went wrong
    - No credits left → clear upgrade CTA

16. **TOAST SYSTEM**: The current error toasts are basic. Create a proper toast component:
    - Success (green), Error (red), Info (blue), Warning (yellow)
    - Auto-dismiss with progress bar
    - Dismiss button
    - Stack multiple toasts
    - Used consistently across the app

### P2 — OUTPUT QUALITY (cycles 17-22)
These improve the websites that 16s generates.

17. **DARK MODE TOGGLE**: Add a rule to the system prompt and generated HTML: every site should include a dark/light mode toggle in the nav. The AI should generate both color schemes in CSS custom properties and a small JS toggle.

18. **FAVICON GENERATION**: When deploying, generate a simple SVG favicon from the brand's first letter + accent color. Include it in the deployed HTML. This is a small touch that makes deployed sites feel more real.

19. **SEO DEFAULTS**: Every generated site should include:
    - Proper <title> with brand name
    - meta description
    - og:title, og:description
    - Proper heading hierarchy (this is in the prompt but verify it works)

20. **ANIMATION QUALITY**: Review the scroll-reveal animations in generated output. They should:
    - Use IntersectionObserver (not scroll event listeners)
    - Have natural stagger timing (0.05-0.1s per element)
    - Respect prefers-reduced-motion
    - Not trigger on elements already in viewport on load

21. **MULTI-PAGE NAVIGATION**: The showPage() routing system needs audit:
    - Does it handle browser back/forward? (It should update URL hash)
    - Do nav links highlight the current page?
    - Is the mobile menu closing after navigation?
    - Do pages fade in/out smoothly?

22. **IMAGE HANDLING**: When users upload images:
    - Verify the AI actually places them correctly (headshot → about, logo → nav, etc.)
    - Verify background removal works and the result looks good in context
    - Test what happens with very large images (>2MB)
    - Test what happens with non-standard aspect ratios

### P3 — DEVELOPER EXPERIENCE (cycles 23-26)

23. **README OVERHAUL**: Current README is probably minimal. Create a comprehensive one:
    - What 16s is (with screenshot)
    - Quick start (clone, install, env vars, run)
    - Architecture overview (key files and what they do)
    - Deployment guide
    - Contributing guidelines

24. **ENV.EXAMPLE UPDATE**: Ensure .env.example has every variable with comments explaining where to get each one.

25. **ERROR BOUNDARY IMPROVEMENTS**: The ErrorBoundary is basic. Add:
    - Error reporting (console + optional Sentry hook)
    - Different fallbacks for different components
    - "Refresh" button that actually reloads the component, not just clears the error state

26. **BUNDLE ANALYSIS**: Run `npx @next/bundle-analyzer` (install if needed). Identify:
    - Is Monaco lazy-loaded? (It should be — it's huge)
    - Is framer-motion tree-shaking properly?
    - Are there any large dependencies that could be replaced?
    - Document findings in progress.txt

### VERIFICATION
After each change:
1. npm run build — must pass
2. Manual spot-check if it's a UI change
3. For architecture changes: verify the same functionality still works
