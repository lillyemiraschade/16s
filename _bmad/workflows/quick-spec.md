# Quick Spec Workflow

For small changes like prompt tweaks, UI adjustments, or minor bug fixes.

## Steps

1. **Describe the change** — What's wrong or what should be different? Include screenshots or conversation examples if relevant.

2. **Identify affected files** — Usually one of:
   - `src/app/api/chat/route.ts` (prompt/AI behavior)
   - `src/app/page.tsx` (UI)
   - `src/lib/ai/anthropic.ts` (AI config)

3. **Define acceptance criteria** — How will you know it works? Be specific:
   - "When user says X, AI responds with Y"
   - "Button appears when Z condition is true"

4. **Implement and test** — Make the change, test manually in the conversation flow.

5. **Verify no regressions** — `npx tsc --noEmit` passes, `npx next build` succeeds, existing conversation flows still work.
