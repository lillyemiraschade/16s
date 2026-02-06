# 16s — Project Instructions

## What This Is
16s is an AI-powered web design platform. Users describe websites in natural language (text or voice), and the AI generates production-ready HTML/React with live preview and one-click deploy.

## Tech Stack
Next.js 14.2, TypeScript, Tailwind CSS, Supabase (DB + Auth), Stripe (billing), Anthropic Claude (Sonnet 4 + Haiku 3.5), Vercel Blob (images), Monaco Editor, Web Speech API.

## Key Files
- src/app/api/chat/route.ts — Core AI endpoint. Contains SYSTEM_PROMPT (~14K tokens). This is the heart of the product.
- src/app/api/chat/voice/route.ts — Voice call AI with VOICE_SYSTEM_PROMPT.
- src/app/page.tsx — Main app: chat + preview split layout, all state management.
- src/components/chat/ChatPanel.tsx — Chat UI, message rendering, image uploads.
- src/components/preview/PreviewPanel.tsx — Live iframe preview, viewport switching, deploy.
- src/lib/projects.ts — Dual-mode storage (localStorage for guests, Supabase for auth users).
- supabase/schema.sql — Database schema with RLS policies.
- SMARTER_16S_PLAN.md — Product vision for planning phase, task lists, QA, agent mode.
- ROADMAP.md — Full product roadmap with phases and priorities.

## Commands
- npm run build — MUST pass after every change. Non-negotiable.
- npm run dev — Local dev server
- npm run lint — Linting

## Rules
1. One focused change per cycle. Never batch multiple unrelated changes.
2. Alternate between code fixes, prompt improvements, and small features.
3. After changing SYSTEM_PROMPT, mentally simulate 3 user scenarios to verify improvement.
4. Never change the JSON response format: {message, html, pills, plan, qaReport}.
5. If adding tokens to the system prompt, cut tokens elsewhere. Target <13K total.
6. Always run npm run build after code changes.
7. Always commit with descriptive message prefixed [Ralph R2].
8. Log every change to CHANGELOG.md with timestamp, description, files, and type.
9. Update progress.txt with what you did and what to tackle next.
10. Do NOT add new API routes, database tables, or major features.
11. Do NOT refactor page.tsx into multiple files — keep the single-file architecture.
12. Do NOT modify the Stripe webhook secret handling or auth callback flow.
13. Read CHANGELOG.md before starting to avoid repeating work from Round 1.
