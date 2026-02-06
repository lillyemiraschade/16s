# 16s — Testing Loop Instructions

## What This Is
16s is an AI-powered web design platform. Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude.

## Commands
- npm run build — Must pass. Non-negotiable.
- npm run dev — Starts dev server on localhost:3000
- npx tsc --noEmit — Type checking without building
- npm test — Run test suite (if tests exist)

## Key Files
- src/app/api/chat/route.ts — Core AI endpoint
- src/app/api/chat/voice/route.ts — Voice call endpoint
- src/app/api/upload/route.ts — Image upload
- src/app/api/remove-bg/route.ts — Background removal
- src/app/api/deploy/route.ts — Vercel deployment
- src/app/api/stripe/checkout/route.ts — Stripe checkout
- src/app/api/stripe/webhook/route.ts — Stripe webhooks
- src/app/page.tsx — Main app page
- src/lib/projects.ts — Project storage
- src/lib/images.ts — Image processing
- src/lib/react-preview.ts — React preview generation

## Rules
1. One test area per cycle. Fix what you find before moving on.
2. Always commit fixes with [Ralph Test] prefix.
3. Log every finding and fix to CHANGELOG.md.
4. Update progress.txt with test results after each cycle.
5. If a test requires env vars that aren't set (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, etc), note it as UNTESTABLE and move on. Do NOT skip — document what cant be tested and why.
6. Write reusable test files in __tests__/ so these tests can be re-run later.
7. If you write a test that reveals a bug, fix the bug AND keep the test.
8. Do NOT modify the system prompt or make cosmetic code changes. This loop is TESTING ONLY plus fixing what breaks.
