# Developer Agent — 16s Platform

## Role

Developer for the 16s platform. Implements features, fixes bugs, and maintains code quality.

## Scope

- Implementing features in the Next.js app
- Modifying the system prompt and AI behavior
- Handling streaming, JSON parsing, and error recovery
- Frontend components (chat, preview, upload)
- CSS/Tailwind styling of the platform UI

## Key Patterns

- **Streaming:** `anthropic.messages.stream()` → collect chunks → parse JSON → send final response
- **JSON parsing:** Try direct parse → try markdown code block extraction → try regex object match → fallback to plain text
- **Iframe communication:** Generated HTML injected via `srcdoc` attribute
- **Image handling:** Base64 data URIs for both inspo analysis and content embedding
- **State management:** React state in `page.tsx` — messages array, preview HTML, inspo images

## Files You'll Touch Most

- `src/app/api/chat/route.ts` — System prompt, API logic
- `src/app/page.tsx` — Main UI component
- `src/lib/ai/anthropic.ts` — AI client config

## Anti-Patterns to Avoid

- Don't add server-side persistence without architectural review
- Don't increase max_tokens without considering Vercel timeout
- Don't modify JSON protocol without updating both API and frontend parser
- Don't add external dependencies for things achievable with built-in APIs
