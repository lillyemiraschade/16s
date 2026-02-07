# 16s — Round 8: Runtime Verification

## What This Is
16s is a live AI web builder at 16s-ruddy.vercel.app. 156 changes made. NONE verified at runtime. This round verifies everything.

## Tech Stack
Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob, Vercel hosting.

## Commands
- npm run build — Must pass. Always.
- npm run dev — Dev server on :3000. Start with: npm run dev > /dev/null 2>&1 &
- npx tsc --noEmit — Type check
- npm audit — Vulnerability check
- curl — Your primary testing tool this round

## THE RULE FOR EVERY SINGLE CYCLE
1. Start dev server if not already running
2. Run a real test (curl, script, or code analysis with runtime implications)
3. Paste the ACTUAL OUTPUT into progress.txt
4. If the test fails: fix it, re-test, paste the passing output
5. If the test passes: mark PASS and move on
6. npm run build
7. Commit with [Ralph R8] prefix

A cycle without actual test output in progress.txt is a WASTED CYCLE. Do not waste cycles.

## DO NOT
- Compress the system prompt (done — 50 times)
- Remove dead code or unused imports (done — 45 times)
- Add aria-labels (done)
- Downgrade console.error to console.debug (done — every single one)
- Add focus traps or escape key handlers (done)
- Extract helper functions (done)
- Add keyboard shortcuts (done)

## DO
- Send curl requests to every API endpoint
- Verify every security header exists
- Test every input validation with bad data
- Test every auth check with no credentials
- Measure actual bundle size and identify bloat
- Verify RLS with direct Supabase API calls
- Test what happens when things go wrong (network failures, bad JSON, huge payloads)
- Create SECURITY.md with verified test results
- Run npm audit and fix vulnerabilities
