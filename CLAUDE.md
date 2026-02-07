# 16s — Round 14: Edge of Perfection

## Context
13 rounds complete. Infrastructure is bulletproof. Sharing, custom domains, templates, deployment history all shipped. This round adds every remaining feature that makes 16s competitive with Lovable/Base44/v0 — stock photos, working contact forms, GitHub export, email notifications, SEO/accessibility scoring, and more.

## Tech Stack
Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob/API, Vercel hosting.

## Commands
```
npm run build && npm test && npx tsc --noEmit
```

## Commit: [Ralph R14-N]

## BANNED
All infrastructure/cleanup. Only product features.

## ⚡ NEW API KEYS NEEDED (user must obtain these)
After this round, the .env.example will include these NEW variables:

```bash
# --- EXISTING (already configured) ---
ANTHROPIC_API_KEY=           # https://console.anthropic.com/settings/keys
NEXT_PUBLIC_SUPABASE_URL=    # https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VERCEL_TOKEN=                # https://vercel.com/account/tokens
VERCEL_TEAM_ID=              # https://vercel.com/account (Team Settings → General)
BLOB_READ_WRITE_TOKEN=       # https://vercel.com/dashboard/stores (Blob Store → Tokens)
STRIPE_SECRET_KEY=           # https://dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=       # https://dashboard.stripe.com/webhooks (endpoint signing secret)
STRIPE_PRO_PRICE_ID=         # https://dashboard.stripe.com/products (create Pro product → copy price ID)
STRIPE_TEAM_PRICE_ID=        # https://dashboard.stripe.com/products (create Team product → copy price ID)
REMOVE_BG_API_KEY=           # https://www.remove.bg/dashboard#api-key

# --- NEW (this round) ---
RESEND_API_KEY=re_pTxhuSV4_3WT9YbV81c5unMBBbqqwmECT
RESEND_FROM_EMAIL=hello@try16s.app    # Verify this domain at https://resend.com/domains first
GITHUB_CLIENT_ID=Iv23liNFmu0P9ssBejC5
GITHUB_CLIENT_SECRET=39657b5d2d57a87ae2426ae20f61ed4396ed3868
NEXT_PUBLIC_POSTHOG_KEY=phc_9fZ5NxgEj3h7CPAeG18yoJPVqZd3UelrDyRu2GRkS1t
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=      # https://sentry.io/settings/projects/ → Select project → Client Keys (DSN)
```

## PRIORITY ORDER

### P0 — CONTACT FORM BACKEND (cycles 1-3)
Generated sites have contact forms that don't actually work. This is the #1 complaint users will have.

4. **Form submission API**
   Create src/app/api/forms/route.ts:
   ```typescript
   // POST — receives form submissions from deployed sites
   // Body: { projectId, formId, fields: { name, email, message, ... } }
   // 1. Validate projectId exists and has active deployment
   // 2. Store submission in Supabase (form_submissions table)
   // 3. Send email notification to project owner via Resend
   // 4. Return { success: true }
   ```

   Schema: form_submissions table with id, project_id, user_id (owner), form_data JSONB, created_at.

   CORS: Allow requests from any *.vercel.app domain (deployed sites post back to 16s API).

5. **Inject form handling into generated HTML**
   When the AI generates a site with a contact form, the post-processor should inject a small script at the bottom:
   ```javascript
   document.querySelectorAll('form').forEach(form => {
     form.addEventListener('submit', async (e) => {
       e.preventDefault();
       const data = Object.fromEntries(new FormData(form));
       const btn = form.querySelector('[type="submit"]');
       btn.disabled = true; btn.textContent = 'Sending...';
       try {
         await fetch('https://16s.dev/api/forms', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ projectId: '{{PROJECT_ID}}', fields: data })
         });
         btn.textContent = '✓ Sent!';
         form.reset();
       } catch { btn.textContent = 'Error — try again'; btn.disabled = false; }
     });
   });
   ```

   Replace {{PROJECT_ID}} with the actual project ID at deploy time.

6. **Form submissions dashboard**
   Create src/app/submissions/page.tsx (or a section in the projects page):
   - List of form submissions per project
   - Each submission: sender name, email, message, timestamp
   - Mark as read/unread
   - Basic — just a table. This can be fancy later.

### P1 — EMAIL NOTIFICATIONS (cycles 4-6)
Users should know when things happen without checking the app.

7. **Resend integration**
   Create src/lib/email.ts:
   ```typescript
   import { Resend } from 'resend';

   const resend = new Resend(process.env.RESEND_API_KEY);
   const FROM = process.env.RESEND_FROM_EMAIL || 'hello@16s.dev';

   export async function sendEmail(to: string, subject: string, html: string) {
     if (!process.env.RESEND_API_KEY) return; // silently skip if not configured
     await resend.emails.send({ from: FROM, to, subject, html });
   }
   ```

   Install: npm install resend

8. **Email templates + triggers**
   Create src/lib/email-templates.ts with simple HTML templates (inline CSS, no framework needed):
   - **Welcome email**: Sent on signup. "Welcome to 16s! Here's how to build your first site."
   - **Deploy notification**: "Your site is live! [URL]"
   - **Form submission notification**: "New message from your {site name} contact form"
   - **Shared project notification**: "Your project {name} is now public at {url}"

   Wire triggers:
   - Welcome: in auth callback or signup webhook
   - Deploy: after successful deployment in deploy route
   - Form: in the forms route (item 4)
   - Share: in the share route (item 4 from R13)

9. **Email preferences**
   Add email_notifications BOOLEAN to the subscriptions table (default true).
   Check before sending. Let users toggle in account settings.

### P2 — GITHUB EXPORT (cycles 7-9)
Users want their code in a repo, not trapped in 16s.

10. **GitHub OAuth flow**
    GitHub is already a Supabase auth provider (OAuth button exists in AuthModal). But for repo access, users need to grant additional scopes.

    Create src/app/api/github/auth/route.ts:
    - Redirects to GitHub OAuth with `repo` scope
    - Callback stores the access token in Supabase (encrypted in user metadata or a separate table)
    - This is separate from the Supabase auth GitHub login — this is for repo access

11. **Export to GitHub API**
    Create src/app/api/github/export/route.ts:
    ```typescript
    // POST { projectId, repoName?, private? }
    // 1. Get user's GitHub token
    // 2. Create repo if it doesn't exist (GitHub API: POST /user/repos)
    // 3. Commit the HTML as index.html (GitHub Contents API: PUT /repos/{owner}/{repo}/contents/index.html)
    // 4. If React mode: generate package.json, src/App.tsx, etc.
    // 5. Return { repoUrl, commitUrl }
    ```

    For V1: single commit with index.html. Don't overcomplicate with git history.

12. **Export button in UI**
    In the export menu (PreviewToolbar), add "Push to GitHub":
    - If not connected: "Connect GitHub" button → OAuth flow
    - If connected: repo name input (defaults to project name), public/private toggle, "Push" button
    - Success: show repo URL with "Open on GitHub" link

### P3 — REAL ANALYTICS (cycles 10-11)
The R12 analytics utility logs to console. Replace with PostHog for real tracking.

13. **PostHog integration**
    Install: npm install posthog-js

    Create src/lib/posthog.ts:
    ```typescript
    import posthog from 'posthog-js';

    export function initPostHog() {
      if (typeof window === 'undefined') return;
      if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
      });
    }

    export { posthog };
    ```

    Initialize in Providers.tsx on mount. Update the analytics.ts track() function to call posthog.capture() instead of console.debug in production.

14. **Sentry error monitoring**
    Install: npm install @sentry/nextjs

    Run: npx @sentry/wizard@latest -i nextjs

    This creates sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, and next.config.js instrumentation.

    Update the error-reporter.ts to call Sentry.captureException() in production instead of the manual fetch.

### P4 — SITE QUALITY SCORING (cycles 12-14)
Show users how good their generated site is.

15. **Accessibility audit**
    Install: npm install axe-core (already small, ~200KB)

    After generation, run axe-core on the preview iframe content:
    ```typescript
    const axe = (await import('axe-core')).default;
    const results = await axe.run(iframeDocument);
    // results.violations = accessibility issues
    // results.passes = things done right
    ```

    Show as a score card in the QA report: "Accessibility: 94/100 (2 minor issues)"
    List violations with fix suggestions as pills: "Fix contrast on footer text", "Add alt text to hero image"

16. **SEO checker**
    After generation, check the HTML for:
    - Has <title> tag
    - Has meta description
    - Has og:title and og:description
    - Has proper heading hierarchy (only one h1)
    - All images have alt text
    - Has favicon
    - Has canonical URL

    Show as: "SEO: 8/10 — Missing: og:image, canonical URL"

    Implement as a pure function in src/lib/quality/seo-checker.ts — no external API needed.

17. **Performance hints**
    Check the generated HTML for:
    - Images have loading="lazy"
    - Fonts use preconnect
    - No render-blocking scripts
    - CSS is inlined (it always is for single-file HTML)
    - Total HTML size (warn if >500KB)

    Show as: "Performance: ✓ All good" or flag specific issues.

    Combine all three scores into a "Site Quality" card shown after generation, next to or inside the QA report.

### P5 — POLISH (cycles 15-17)

18. **Favicon in browser tab**: The 16s app itself should have a proper favicon. Create a simple SVG favicon — the "16s" logo mark or just "16" in a rounded square. Add to /public/favicon.svg and reference in layout.tsx.

19. **OG image for sharing**: When a project is shared, generate a simple OG image. Use @vercel/og or a simple HTML→image approach. The OG image should show: project name + "Built with 16s" + a preview thumbnail (or just a branded card).

20. **Update .env.example**: Add ALL new env vars with comments explaining where to get each key. Group by service. This is the "API keys needed" reference doc.

### VERIFICATION
After each change:
1. npm run build + npm test pass
2. For new API routes: test with curl
3. For new env vars: gracefully degrade if not set (don't crash)
4. Every new integration should be OPTIONAL — the app must still work without it
