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
The generated website preview uses `<iframe srcDoc sandbox="allow-scripts allow-popups">`.
- `allow-scripts`: Required for interactive preview (navigation, forms, animations)
- `allow-popups`: Required for target="_blank" links in generated sites
- No `allow-same-origin` — iframe cannot access parent cookies, localStorage, or DOM
- PostMessage communication uses `'*'` origin with type-prefix validation (`16s-`)
- CSP meta tag injected into srcdoc: `connect-src 'none'; frame-src 'none'` prevents network requests and nested iframes

## Runtime Verification (Round 8 — Feb 2026)

All security controls verified against running dev server with actual curl requests.

### Pen Test Findings — All Verified
| Finding | Test | Result |
|---------|------|--------|
| 1M char input | POST /api/chat with 1M char message | 400 "Message too long" |
| CORS bypass | OPTIONS /api/chat with Origin: evil.com | 403 Forbidden |
| Missing CSP | Check response headers on / | Full CSP policy present |
| Supabase RLS | Query User/projects/deployments with anon key | Empty arrays (no data) |
| Deploy no auth | POST /api/deploy without session | 401 Unauthorized |
| Upload no auth | POST /api/upload without session | 401 "Sign in" |
| Remove-bg no auth | POST /api/remove-bg without session | 401 "Sign in" |
| Error leaks | Malformed JSON, wrong method, bad content type | Generic errors only |

### Endpoint Hardening — All Verified
| Endpoint | Tests | Result |
|----------|-------|--------|
| /api/chat | Empty body, bad types, 200 msgs, system role, non-JSON | All rejected with specific Zod errors |
| /api/chat/voice | Empty body, wrong schema | 400 with generic error |
| /api/upload | No auth, empty, non-image | 401 on all |
| /api/remove-bg | No auth, empty, missing fields | 401 on all |
| /api/deploy | No auth, empty, 5MB payload | 401 on all |
| /api/stripe/checkout | No auth, invalid plan, missing plan | 401 on all |
| /api/stripe/webhook | No signature, fake signature | 400/500 (correct) |
| /auth/callback | No code, open redirect attempt | Redirects to / only |

### Security Headers — All Present
CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, COOP, COEP, CORP, Permissions-Policy. X-Powered-By removed.

### Build Health
- `npm run build`: 0 warnings, all 14 pages generated
- `npx tsc --noEmit`: 0 errors
- `npm audit`: 4 vulnerabilities in Next.js 14.2.18 (upgrade to 14.2.35+ deferred)
- Bundle: 276 kB First Load JS (main page), 87.2 kB shared

### Static Files
- `/robots.txt`: Disallows /api/, /auth/, /projects/
- `/.well-known/security.txt`: Contact info present
- `/sitemap.xml`: Valid with canonical URL
- `/manifest.json`: Valid PWA manifest
- `/.env`, `/.git/config`: Both return 404
