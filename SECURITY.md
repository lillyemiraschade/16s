# 16s Security Model

## Reporting Vulnerabilities
Email: security@16s.dev

## Authentication & Authorization
- **Supabase Auth** handles all user authentication (email/password, OAuth).
- **Row Level Security (RLS)** on all database tables ensures users can only access their own data.
- Every RLS policy restricts to `auth.uid() = user_id`.
- The Supabase anon key is safe to expose client-side because RLS enforces access control at the database level.

## API Route Security
| Route | Auth Required | Rate Limit | Notes |
|-------|--------------|------------|-------|
| `/api/chat` | No (free tier) | 20/min (IP) | Credit deduction for auth users |
| `/api/chat/voice` | No (free tier) | 30/min (IP) | Uses Sonnet (expensive) |
| `/api/upload` | Yes | 15/min (IP) | Vercel Blob storage costs |
| `/api/remove-bg` | Yes | 5/min (IP) | remove.bg API costs |
| `/api/deploy` | Yes | 5/min (IP) | Creates Vercel deployments |
| `/api/stripe/checkout` | Yes | — | Creates Stripe sessions |
| `/api/stripe/portal` | Yes | — | Stripe billing portal |
| `/api/stripe/webhook` | Stripe signature | — | Service role for DB writes |

## Input Validation
- Client: `maxLength=10000` on all textareas
- Server: Zod schema validation on all API routes
  - Chat messages: max 15KB per message, max 100 messages
  - Voice messages: max 10KB per message, max 50 messages
  - Pre-schema check rejects last user message over 10K chars
- Upload: 5MB server-side limit with dual check (content-length + data length)
- Remove-bg: 10MB server-side limit

## CORS Policy
- Origin allowlist enforced in middleware for all `/api/*` routes
- Allowed: `16s-ruddy.vercel.app`, `16s.dev`, `www.16s.dev`
- `localhost:3000` allowed only in development (`NODE_ENV`)
- Requests with no Origin header are allowed (Stripe webhooks, non-browser clients)
- Unknown origins receive 403 Forbidden

## Security Headers
- **Content-Security-Policy**: Locked down to self + cdn.jsdelivr.net (Monaco) + Supabase + Vercel Blob
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Cross-Origin-Opener-Policy**: same-origin-allow-popups (for OAuth)
- **Cross-Origin-Resource-Policy**: same-origin
- **Permissions-Policy**: Restricts camera, geolocation, payment, USB, bluetooth, serial, display-capture
- **X-Powered-By**: Removed

## Accepted Risks
1. **User UUID in Supabase query params**: Standard Supabase client behavior. HTTPS encrypts in transit, RLS prevents cross-user access, UUIDs are not guessable.
2. **Build ID / RSC payload in responses**: Standard Next.js behavior. Cannot be suppressed without ejecting.
3. **Vercel headers (x-vercel-id, Server)**: Cannot be removed on Vercel hosting.
4. **Monaco CDN without SRI**: `@monaco-editor/react` loads dynamically via AMD loader. SRI not feasible without forking the library. CSP script-src restriction to cdn.jsdelivr.net is the mitigation.
5. **`unsafe-eval` in CSP**: Required for Monaco Editor's AMD module loader.
6. **`unsafe-inline` in CSP**: Required for Next.js inline styles and Tailwind CSS runtime.
7. **Client-side rendering**: The app requires browser APIs (localStorage, WebSpeech, etc.). SSR skeleton includes noscript fallback and proper meta tags for crawlers.

## Preview Iframe Sandbox
The generated website preview uses `<iframe srcDoc sandbox="allow-scripts allow-same-origin">`.
- `allow-scripts`: Required for interactive preview
- `allow-same-origin`: Required for postMessage communication
- No `allow-top-navigation` or `allow-popups` — prevents escape from iframe
