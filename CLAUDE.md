# 16s — Round 10: Deep Clean, Streaming & Component Polish

## Context
After 9 rounds (179 changes): architecture extracted (hooks, shared rate limiter, prompt file, env validation, API helpers), security hardened and verified, prompt refined, app UI polished, features added.

## What's Left — The Honest Assessment
1. **ChatPanel (858 lines) and PreviewPanel (931 lines) are still bloated** — R9 split page.tsx but these two components weren't touched
2. **No real-time streaming to the user** — the API uses Anthropic streaming internally but buffers the ENTIRE response before sending it. Users see nothing until the full response is complete. This is the single biggest UX gap.
3. **No test coverage at all** — zero test files in the project
4. **The response parsing is fragile** — both server-side (route.ts) and client-side (page.tsx) have multi-layer JSON extraction with regex fallbacks
5. **VoiceCall (489 lines) uses Web Speech API** which is unreliable and Chrome-only
6. **No loading skeleton or progress indicator during AI generation** — users just see a typing indicator with no sense of progress

## Tech Stack
Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob, Vercel hosting.

## Commands
```
npm run build          # Must pass after every change
npm run dev            # Dev server
npx tsc --noEmit       # Type check
```

## Commit Rules
- Prefix: [Ralph R10-N]
- One logical change per commit
- Build must pass before committing

## BANNED (exhausted in prior rounds)
- Prompt compression or restructuring (done 50+ times)
- Dead code removal (done)
- console.error downgrades (done)
- aria-labels, focus traps, escape handlers (done)
- Keyboard shortcuts (done)
- Rate limiter changes (just consolidated in R9)
- Extracting hooks from page.tsx (just done in R9)

## PRIORITY ORDER

### P0 — STREAMING (the biggest UX win possible)
**This is the #1 priority.** Currently the API streams from Anthropic but buffers everything server-side, then sends the complete JSON blob at the end. Users wait 5-15 seconds seeing only a typing indicator.

Implement proper streaming:

1. **Server**: Stream partial text tokens to the client as they arrive from Anthropic. Use Server-Sent Events or chunked text. When HTML/React code starts appearing in the stream, send a signal so the client can show partial preview.

2. **Client**: Show the AI's message text appearing word-by-word as it streams. When HTML starts streaming, begin rendering partial preview. Show a progress indicator based on token count.

3. **Protocol**: Use newline-delimited JSON chunks:
   ```
   {"type":"text","content":"Here's what I'm thinking..."}
   {"type":"text","content":" I'll create a modern layout"}
   {"type":"html_start"}
   {"type":"html_chunk","content":"<!DOCTYPE html><html>..."}
   {"type":"html_chunk","content":"<head>..."}
   {"type":"complete","message":"...", "pills":[...], "html":"...", "qaReport":{...}}
   ```

4. **Fallback**: If streaming fails, fall back to buffered response (current behavior).

### P1 — COMPONENT SPLITS (maintainability)

5. **ChatPanel split (858 → ~400 lines)**:
   - Extract message rendering to ChatMessage.tsx (single message bubble with edit, images, plan card, QA report)
   - Extract image upload bar to ImageUploadBar.tsx (thumbnail strip, upload button, type toggle, bg remove)
   - Extract input area to ChatInput.tsx (textarea, send button, pill rendering)
   - ChatPanel.tsx becomes composition: message list + image bar + input

6. **PreviewPanel split (931 → ~400 lines)**:
   - Extract toolbar to PreviewToolbar.tsx (viewport buttons, undo/redo, export menu, deploy button)
   - Extract version history to VersionHistory.tsx (history dropdown, bookmarks)
   - Extract GeneratingState to its own file (it's already a separate function)
   - PreviewPanel.tsx becomes: toolbar + iframe + generating state + version history

### P2 — RESPONSE PARSING CLEANUP

7. **Server-side**: The JSON parsing in route.ts has 5 nested fallback strategies (direct parse → markdown fence → last line → last object → regex). Consolidate into a clean `parseAIResponse(text: string): ChatResponse` function in src/lib/ai/parse-response.ts. Add proper typing and unit-test-ready structure.

8. **Client-side**: fetchAndParseChat in page.tsx (or now useChat.ts) has the same multi-fallback pattern. With streaming (P0), most of this goes away — the server sends pre-parsed JSON chunks. Simplify the client parser to just handle the streaming protocol.

### P3 — TESTING FOUNDATION

9. **Setup**: Install vitest + @testing-library/react. Create vitest.config.ts. This is the testing foundation — once it exists, future rounds can add tests incrementally.

10. **Unit tests for critical paths**:
    - src/lib/rate-limit.test.ts — rate limiter logic (created in R9)
    - src/lib/ai/parse-response.test.ts — JSON parsing fallbacks
    - src/lib/api-utils.test.ts — apiError/apiSuccess helpers

11. **Integration test for chat API**:
    - Mock Anthropic SDK
    - Test: valid request → 200, no auth → allows (free tier), invalid JSON → 400, rate limit → 429
    - This catches regressions from future changes

### P4 — REMAINING POLISH

12. **VoiceCall reliability**: Add a fallback message when Web Speech API isn't available: "Voice calls work best in Chrome. Try typing your ideas instead." Currently it shows "unsupported" which isn't helpful.

13. **Preview iframe sandboxing audit**: Verify the iframe has proper sandbox attributes. Generated HTML runs in the preview — it shouldn't be able to access the parent frame, make network requests to 16s APIs, or access localStorage of the main app.

14. **Deploy flow improvements**:
    - Show deployed URL more prominently after deploy
    - Add "Copy URL" button on the deploy success state
    - Add "Open in new tab" button
    - Show a QR code for the deployed URL (users testing on phone)

15. **Mobile chat/preview toggle**: On mobile, chat and preview should be separate tabs (not side-by-side). Verify this works well after R9 responsive changes. The toggle should be sticky and obvious.

16. **Autosave indicator**: Show a subtle "Saved" or "Saving..." indicator near the project name so users know their work is being saved. Currently autosave happens silently with no feedback.

### VERIFICATION
After each change:
1. npm run build passes
2. For streaming: test with actual AI response (npm run dev)
3. For component splits: verify same visual output
4. For tests: npm test passes
