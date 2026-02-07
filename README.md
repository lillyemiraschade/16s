# 16s - AI Web Designer

Describe your dream website in plain English. 16s builds it in seconds with AI - live preview, one-click deploy.

**Live at [16s-ruddy.vercel.app](https://16s-ruddy.vercel.app)**

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd 16s
npm install

# Configure environment
cp .env.example .env.local
# Fill in your API keys (see .env.example for details)

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

**Required** (app won't start without these):
- `ANTHROPIC_API_KEY` - Claude API key for AI generation
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

**Optional** (features degrade gracefully):
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob for image uploads
- `REMOVE_BG_API_KEY` - remove.bg for background removal
- `VERCEL_TOKEN` / `VERCEL_TEAM_ID` - One-click deploy
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Payments
- `SUPABASE_SERVICE_ROLE_KEY` - Stripe webhook processing

See `.env.example` for where to get each key.

## Architecture

```
src/
  app/
    page.tsx              Main UI — composes hooks, layout, render
    projects/page.tsx     Project list view
    api/
      chat/route.ts       AI chat endpoint (Haiku for simple, Sonnet for complex)
      deploy/route.ts     Vercel deployment API
      upload/route.ts     Image upload to Vercel Blob
      remove-bg/route.ts  Background removal proxy
      stripe/             Checkout, portal, webhook
  lib/
    ai/prompts.ts         System prompt + React addendum (~380 lines)
    hooks/
      useChat.ts          Message state, AI communication, streaming
      usePreview.ts       Preview state, history, undo/redo, bookmarks
      useImages.ts        Image upload, compression, type toggle
      useWelcome.ts       Welcome screen state, headline rotation
      useProjects.ts      Save/load with local + cloud dual mode
      useDeployment.ts    Deploy to Vercel
    projects.ts           Project persistence (localStorage + Supabase)
    images.ts             Image compression, blob upload
    rate-limit.ts         Shared rate limiter factory
    api-utils.ts          apiError/apiSuccess response helpers
    env.ts                Typed env var validation
    error-reporter.ts     Structured error reporting (dev: console, prod: endpoint)
    types.ts              Shared TypeScript interfaces
  components/
    chat/
      ChatPanel.tsx       Chat interface, messages, input
      ChatMessage.tsx     Single message bubble
      ChatInput.tsx       Input area with send button
      ImageUploadBar.tsx  Image thumbnail strip
    preview/
      PreviewPanel.tsx    Live preview, toolbar, code editor
      PreviewToolbar.tsx  Viewport, export, deploy controls
      VersionHistory.tsx  History dropdown, bookmarks
    auth/                 AuthModal, UserMenu, MigrationBanner
    GlobalErrorHandler.tsx  Window error/rejection catcher
    Toast.tsx             Toast notification system
    ErrorBoundary.tsx     Error boundary with fallback UI
e2e/
  smoke.spec.ts           Playwright smoke tests (5 tests)
.github/workflows/ci.yml  GitHub Actions CI pipeline
```

## Key Features

- **AI Generation**: Describe a website, get working HTML with real copy, forms, and interactions
- **Inspiration Cloning**: Upload screenshot(s) of sites you like, AI clones the style
- **Image Intelligence**: Upload logos, photos, products - AI places them contextually
- **Voice Calls**: Built-in AI voice design consultation
- **Live Preview**: Real-time preview with viewport switching, undo/redo, bookmarks
- **Code Editor**: Monaco-based code editing with live reload
- **One-Click Deploy**: Deploy to Vercel with a single click
- **Dark/Light Toggle**: Generated sites include theme switching
- **Multi-Page Routing**: Generated sites have hash-based navigation with back/forward support

## Commands

```bash
npm run dev            # Dev server (HTTPS, requires certificates/)
npm run dev:http       # Dev server (HTTP, no certs needed)
npm run build          # Production build
npm test               # Unit tests (vitest, 28 tests)
npm run test:e2e       # E2E tests (Playwright, 5 smoke tests)
npm run check          # Full pre-push check: tsc + build + test
npx tsc --noEmit       # Type check only
```

## CI/CD

GitHub Actions runs on push/PR to main:
- **check** job: type check, build, unit tests
- **e2e** job: Playwright smoke tests with Chromium

## Testing

- **Unit tests** (vitest): rate limiter, API response parser, API utils, chat API integration, Stripe webhook — 28 tests
- **E2E tests** (Playwright): homepage, idea pills, chat flow with mock API, preview iframe, projects page — 5 tests
- Tests run in CI automatically. Run `npm run check` locally before pushing.

## Security

- **Iframe sandbox**: `allow-scripts allow-popups` (no `allow-same-origin` — generated HTML cannot access parent cookies/storage/DOM)
- **Preview CSP**: `connect-src 'none'` prevents generated HTML from making fetch/XHR requests
- **postMessage validation**: Messages validated by `16s-` type prefix
- **CORS/CSP**: Configured in middleware and Next.js config
- **RLS**: All Supabase tables use Row Level Security
- **Rate limiting**: All API routes rate-limited (shared factory)
- **Auth**: Supabase Auth with email + OAuth providers

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **AI**: Anthropic Claude (Haiku + Sonnet)
- **Database**: Supabase (Postgres + Auth + RLS)
- **Storage**: Vercel Blob
- **Payments**: Stripe
- **Hosting**: Vercel
