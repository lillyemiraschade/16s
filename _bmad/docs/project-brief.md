# 16s — Project Brief

## What is 16s?

16s is an AI web designer that helps non-technical users build beautiful websites through conversation. Users describe what they want, optionally upload inspiration images, and the AI generates complete, multi-page websites in real time.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **AI:** Anthropic Claude API (streaming)
- **Styling:** Tailwind CSS (platform UI); inline CSS (generated sites)
- **Deployment:** Vercel

## Architecture

- `src/app/page.tsx` — Main chat + preview layout
- `src/app/api/chat/route.ts` — Chat API route (system prompt, streaming, JSON parsing)
- `src/lib/ai/anthropic.ts` — Anthropic client config
- Generated websites are single HTML documents with client-side routing, rendered in an iframe

## Key Patterns

- **Streaming responses:** Claude streams tokens; the API collects them, parses JSON, and sends the final result
- **JSON protocol:** AI responds with `{ message, pills?, showUpload?, html? }`
- **Iframe preview:** Generated HTML is injected into an iframe via srcdoc
- **Inspo image cloning:** Base64 images sent to Claude for pixel-perfect style replication
- **Content image embedding:** User photos/logos embedded as base64 data URIs in generated HTML

## Constraints

- Vercel function timeout: 120s max
- Claude max tokens: 16,000 per response
- Generated sites must be self-contained single HTML documents
- No server-side persistence (stateless API)
