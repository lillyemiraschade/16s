# 16s — Project Instructions

## What This Is
16s is an AI-powered web design platform. Users describe websites in natural language (text or voice), and the AI generates production-ready HTML/React with live preview and one-click deploy.

## Tech Stack
Next.js 14.2, TypeScript, Tailwind CSS, Supabase (DB + Auth), Stripe (billing), Anthropic Claude (Sonnet 4 + Haiku 3.5), Vercel Blob (images), Monaco Editor, Web Speech API.

## Key Files
- src/app/api/chat/route.ts — Core AI endpoint with SYSTEM_PROMPT (~5.9K tokens). THE HEART OF THE PRODUCT.
- src/app/api/chat/voice/route.ts — Voice call AI with VOICE_SYSTEM_PROMPT.
- src/app/page.tsx — Main app: chat + preview split layout, state management, message handling.
- src/components/chat/ChatPanel.tsx — Chat UI, message rendering, image uploads, pill buttons.
- src/components/preview/PreviewPanel.tsx — Live iframe preview, viewport switching, deploy.
- src/lib/projects.ts — Dual-mode storage (localStorage guests, Supabase auth).
- src/lib/images.ts — Image compression, upload, background removal pipeline.
- src/lib/types.ts — TypeScript interfaces.

## Image System (IMPORTANT — understand this before changing anything)
- Users can upload images tagged as INSPO (design reference) or CONTENT (use in site)
- Inspo images: AI analyzes the design style and clones it
- Content images: AI embeds them in the generated HTML using Vercel Blob URLs
- Background removal: available via remove.bg API, triggered by user clicking sparkle icon
- Images are compressed client-side before upload (inspo: 500KB max, content: 100KB max)
- Up to 5 images per upload, 10MB per file pre-compression

## Commands
- npm run build — MUST pass after every change
- npm run dev — Local dev server
- npm run lint — Linting

## Rules
1. One focused change per cycle. Never batch multiple unrelated changes.
2. Rotate: PROMPT → CODE → PROMPT → CODE. Prompt changes are the priority this round.
3. After changing SYSTEM_PROMPT, simulate 3 real user conversations to verify improvement.
4. Never change the JSON response format: {message, html, pills, plan, qaReport}.
5. System prompt is ~5.9K tokens. If you add, cut elsewhere. Do NOT re-expand past 6.5K.
6. Always run npm run build after code changes.
7. Commit with [Ralph R5] prefix. Log to CHANGELOG.md. Update progress.txt.
8. Do NOT add new API routes or database tables.
9. Do NOT refactor page.tsx into multiple files.
10. Read CHANGELOG.md to avoid repeating work from Rounds 1-4.
11. CONVERSATION FLOW IS THE #1 PRIORITY. The AI should feel like a smart designer leading a client through a discovery call, not a form asking for inputs.
