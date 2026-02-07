# 16s — Round 11: Production Readiness

## Context
10 rounds complete (187+ changes). Architecture clean, security verified, streaming live, components split, 25 tests passing. This is the final hardening round before treating the codebase as production-ready.

## What This Round Does
Ship-blocking gaps: CI/CD, E2E testing, iframe security, error monitoring hooks, and the deferred items from R10. Everything in this round is about "can I deploy this confidently and sleep at night."

## Tech Stack
Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob, Vercel hosting.

## Commands
```
npm run build
npm run dev
npm test              # vitest (25 unit tests from R10)
npx tsc --noEmit
```

## Commit: [Ralph R11-N]

## BANNED (done)
- Prompt changes (done 50+ times)
- Code cleanup, dead code, console.log changes (done)
- Aria-labels, focus traps, keyboard shortcuts (done)
- Component splitting (done — page.tsx, ChatPanel, PreviewPanel all split)
- Rate limiter changes (consolidated in R9)
- Hook extraction (done in R9)

## PRIORITY ORDER

### P0 — CRITICAL BUG: Messages Go Blank During Generation (cycle 1)
R10 added real-time streaming. Since then, messages go blank while the AI is generating. This is a regression that breaks the core UX. Fix this FIRST before anything else.

The bug is almost certainly in the streaming client code (useChat.ts or wherever the stream reader lives). What's happening:
- User sends a message → user message appears in chat ✓
- AI starts generating → the assistant message bubble goes BLANK ✗
- Generation completes → message may or may not appear

Likely causes (check all of these):
1. The streaming handler is REPLACING the messages array instead of APPENDING to it. It should create a new assistant message and UPDATE its content as tokens arrive, not clear everything.
2. The streaming assistant message is being created with empty content and never updated — the state setter might not be receiving the accumulated tokens.
3. Race condition: setMessages is called with a stale closure that doesn't include the user's message, so it overwrites the array.
4. The message content is being set to the raw NDJSON protocol text ({"type":"token","text":"..."}) instead of extracted text.

How to fix:
- Find where the streaming response is processed (useChat.ts or page.tsx)
- Ensure the flow is: (a) add user message to state, (b) add empty assistant message, (c) as tokens arrive, update ONLY that assistant message's content, (d) on stream complete, finalize with pills/qaReport/etc.
- Use a functional state update: `setMessages(prev => prev.map(m => m.id === streamingId ? {...m, content: accumulated} : m))`
- NEVER replace the entire messages array during streaming — always update the specific message

Start the dev server and verify the fix works before moving on. Send a real message, confirm you see text streaming into the chat bubble.

### P0.5 — CI/CD Pipeline (cycles 2-4)
The project has zero automation. No linting on push, no type checking on PR, no test running.

1. **GitHub Actions workflow** — .github/workflows/ci.yml:
   - Trigger: push to main, pull_request to main
   - Steps: checkout → setup Node 20 → npm ci → npx tsc --noEmit → npm run build → npm test
   - Cache node_modules with actions/cache
   - This catches build failures and test regressions before deploy

2. **Pre-commit quality gate** — Add a "check" script to package.json:
   ```json
   "check": "tsc --noEmit && npm run build && npm test"
   ```
   Document in README: run `npm run check` before pushing.

3. **Vercel build settings** — Ensure the Vercel project runs `npm run build` (it should already, but verify). Add `npm test` to the build command if Vercel supports it, or document that tests only run in CI.

### P1 — E2E Test Foundation (cycles 4-6)
Unit tests cover utilities. E2E tests cover user flows.

4. **Playwright setup**:
   - npm install -D @playwright/test
   - npx playwright install chromium (just Chrome, not all browsers)
   - playwright.config.ts: baseURL localhost:3000, webServer starts dev, timeout 30s

5. **Critical path E2E tests** (3-5 tests):
   - Homepage loads, welcome screen visible, idea pills render
   - Type a prompt → see typing indicator → see response in chat
   - Response includes preview → iframe renders HTML
   - Projects page loads (even if empty)
   - Auth modal opens on sign-in click

   These don't need a real Anthropic API key — mock the /api/chat endpoint to return a fixed response.

6. **Add Playwright to CI** — extend the GitHub Actions workflow to run E2E tests. Use the Playwright GitHub Action.

### P2 — Iframe Security Hardening (cycles 7-8)
The preview iframe has `sandbox="allow-scripts allow-same-origin"`. This is dangerous — allow-same-origin + allow-scripts together effectively nullify the sandbox because scripts can remove the sandbox attribute.

7. **Fix iframe sandbox**:
   The problem: generated HTML needs to run JS (for navigation, forms, animations), and the select-mode feature needs postMessage between iframe and parent. But allow-same-origin + allow-scripts = no real sandbox.

   Options (pick the best one):
   a) Use a different origin for preview: serve iframe content via blob: URL or data: URL (different origin blocks direct parent access but postMessage still works with *)
   b) Use srcdoc with just `sandbox="allow-scripts"` (drops same-origin — postMessage still works, but iframe can't access parent cookies/storage)
   c) Keep current setup but add CSP on the iframe content via a meta tag injected into the srcdoc

   Option (b) is probably best: change to `sandbox="allow-scripts allow-popups"` (drop allow-same-origin). Then fix the postMessage origin check — it'll be "null" for sandboxed iframes without same-origin, so check for message type prefix instead of origin.

   IMPORTANT: Test that after this change:
   - Preview still renders and runs JS (navigation, forms, animations)
   - Select mode still works (hover highlight, click to select)
   - postMessage from iframe to parent still works
   - iframe CANNOT access parent's localStorage, cookies, or DOM

8. **Inject CSP into preview HTML**: Before setting srcdoc, inject a meta tag:
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://fonts.googleapis.com https://fonts.gstatic.com; img-src * data: blob:; connect-src 'none';">
   ```
   This prevents the generated HTML from making network requests back to 16s APIs or any external endpoint, while still allowing fonts and inline scripts.

### P3 — Error Monitoring Hooks (cycles 9-10)

9. **Error reporting utility** — src/lib/error-reporter.ts:
   ```typescript
   export function reportError(error: Error, context?: Record<string, unknown>) {
     // In development: console.error
     // In production: send to configured endpoint (Sentry, LogFlare, etc.)
     // For now: just structure the error for future integration
     if (process.env.NODE_ENV === 'development') {
       console.error('[16s Error]', error.message, context);
       return;
     }
     // Future: Sentry.captureException(error, { extra: context });
     // For now: POST to a logging endpoint if configured
     const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
     if (endpoint) {
       fetch(endpoint, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message: error.message, stack: error.stack, context, timestamp: Date.now() }),
       }).catch(() => {}); // fire and forget
     }
   }
   ```

   Wire this into:
   - ErrorBoundary.tsx (componentDidCatch)
   - API route catch blocks (replace console.debug with reportError for actual errors, keep debug for expected conditions)
   - Client-side catch blocks in useChat, useDeployment, useProjects

10. **Global unhandled error/rejection handler** — In layout.tsx or a client component:
    ```typescript
    useEffect(() => {
      const handleError = (e: ErrorEvent) => reportError(new Error(e.message), { type: 'unhandled' });
      const handleRejection = (e: PromiseRejectionEvent) => reportError(new Error(String(e.reason)), { type: 'unhandled_rejection' });
      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleRejection);
      return () => { window.removeEventListener('error', handleError); window.removeEventListener('unhandledrejection', handleRejection); };
    }, []);
    ```

### P4 — Deferred Items From R10 (cycles 11-14)

11. **Autosave indicator**: Small "Saved ✓" or "Saving..." text near the project name in the header. Needs a `saveStatus` state in page.tsx that the autosave timer updates. Subtle — fades in for 2s after save, then fades out.

12. **Deploy flow improvements**:
    - After successful deploy, show the URL prominently with large text
    - "Copy URL" button (one click copy)
    - "Open in new tab" button
    - Optional: QR code using a simple QR library or inline SVG generation

13. **Preview iframe sandbox** — covered in P2 above (items 7-8)

14. **Stripe webhook tests**: Add 2-3 vitest tests for the webhook handler:
    - Valid checkout.session.completed → updates subscription
    - Invalid signature → 400
    - Missing admin client → 500
    Mock Stripe's constructEvent and Supabase client.

### P5 — Final Verification (cycle 15)

15. **Full smoke test**: Start dev server, run through the entire user flow:
    - Load homepage
    - Type a prompt, see streaming response
    - See preview render
    - Upload an image
    - Try voice call (or verify fallback)
    - Switch to projects page
    - npm run build passes
    - npm test passes
    - All CI checks would pass
    - Document results in progress.txt

16. **Update README**: Ensure it reflects the current state:
    - Architecture diagram (text-based)
    - All npm scripts documented
    - CI/CD explained
    - Test coverage summary
    - Security model reference
