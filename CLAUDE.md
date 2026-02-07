# 16s — Round 13: Product Features (Sharing, Custom Domains, Templates)

## Context
12 rounds complete (~210 changes). Infrastructure is done — architecture, security, streaming, testing, CI/CD, performance, onboarding, analytics, discussion mode all shipped. The codebase is production-grade.

This round builds the features that drive adoption and make 16s feel like a real product. No more cleanup. Only user-facing features.

## Tech Stack
Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob/API, Vercel hosting.

## Commands
```
npm run build
npm run dev
npm test
npm run check
```

## Commit: [Ralph R13-N]

## BANNED (done — 12 rounds of it)
All infrastructure, cleanup, refactoring, security hardening, prompt compression, component splitting, testing infrastructure, CI/CD. These are DONE. Only product features this round.

## PRIORITY ORDER

### P0 — PROJECT SHARING (cycles 1-4)
"Look what I built with 16s" is the growth loop. Users need shareable links.

1. **Schema migration: add sharing columns to projects table**
   Create supabase/migrations/add_sharing.sql:
   ```sql
   -- Public sharing support
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_preview TEXT; -- frozen HTML snapshot for sharing

   -- Index for public lookups
   CREATE INDEX IF NOT EXISTS idx_projects_public_slug ON projects(public_slug) WHERE is_public = TRUE;

   -- RLS policy: anyone can READ public projects (by slug)
   CREATE POLICY "Anyone can view public projects" ON projects
     FOR SELECT USING (is_public = TRUE);
   -- Note: existing policy "Users can CRUD own projects" still handles owner access
   ```

   Also update supabase/schema.sql with these columns (for fresh installs).
   Update src/lib/supabase/types.ts to include the new columns.

2. **Share API endpoint: POST /api/share**
   Create src/app/api/share/route.ts:
   - POST: Takes projectId, generates a slug (nanoid 8 chars or project-name-slugified), sets is_public=true, snapshots current_preview into public_preview, returns the share URL
   - DELETE: Takes projectId, sets is_public=false, clears slug and snapshot
   - GET: Takes slug (public, no auth required), returns the public_preview HTML

   The slug should be human-readable: take project name, slugify, append 4 random chars. Example: "tokyo-ramen-shop-a3f2"

   Rate limit: 10 shares per minute per user.

3. **Public project page: /share/[slug]**
   Create src/app/share/[slug]/page.tsx:
   - Server component that fetches the public project by slug
   - Renders the frozen HTML in a full-screen iframe
   - Header bar at top: "Built with 16s" branding + "Build your own" CTA button linking to homepage
   - The header should be minimal — not obstructing the site preview
   - If slug not found: 404 page with "This project doesn't exist or was unpublished"
   - OG meta tags: title = project name, description = "Built with 16s", image = auto-generated (or skip for now)

4. **Share button in the UI**
   In PreviewToolbar (or wherever the deploy button lives):
   - Add a "Share" button next to Deploy
   - Clicking opens a small popover/modal:
     - If not shared: "Share this project publicly?" + Share button
     - If already shared: shows the URL, Copy button, "Unshare" button
   - After sharing: show success toast with the URL
   - The share URL format: https://16s.dev/share/tokyo-ramen-shop-a3f2 (or whatever the domain is)

### P1 — CUSTOM DOMAINS (cycles 5-8)
Deployed sites currently get ugly random Vercel URLs. Users need custom domains.

5. **Schema: add custom domain tracking**
   Add to supabase/migrations/add_domains.sql:
   ```sql
   CREATE TABLE IF NOT EXISTS domains (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     domain TEXT NOT NULL UNIQUE,
     status TEXT DEFAULT 'pending', -- pending, verifying, active, failed
     vercel_domain_id TEXT,
     verification_token TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users manage own domains" ON domains FOR ALL USING (auth.uid() = user_id);
   CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
   CREATE INDEX IF NOT EXISTS idx_domains_project_id ON domains(project_id);
   ```

6. **Domain API: /api/domains**
   Create src/app/api/domains/route.ts:
   - POST: Add domain to Vercel project via Vercel Domains API, save to DB, return verification instructions
   - GET: Check domain verification status via Vercel API, update DB
   - DELETE: Remove domain from Vercel, delete from DB

   Vercel Domains API:
   ```
   POST https://api.vercel.com/v10/projects/{projectId}/domains
   Body: { "name": "example.com" }

   GET https://api.vercel.com/v10/projects/{projectId}/domains/{domain}
   Returns: verification status, DNS records needed
   ```

   Pro plan required (check subscription before allowing).

7. **Domain management UI**
   In the deploy success area or a new settings panel:
   - "Connect custom domain" button (Pro only — show upgrade CTA for free users)
   - Input for domain name
   - After adding: show DNS instructions (CNAME record pointing to cname.vercel-dns.com)
   - Verification status indicator (pending → checking → active)
   - Auto-refresh status every 30 seconds while pending

   Keep it simple — this is V1. Just domain connection + DNS instructions + status.

8. **Domain status in projects list**
   On the projects page, show the custom domain (if any) under each project card. Small badge: "→ example.com" or "→ vercel.app URL"

### P2 — TEMPLATE SYSTEM (cycles 9-12)
Starting from a blank prompt is intimidating. Templates give users a head start.

9. **Template data structure**
   Create src/lib/templates.ts:
   ```typescript
   export interface Template {
     id: string;
     name: string;
     description: string;
     industry: string;
     prompt: string; // the initial prompt that generates this template
     thumbnail?: string; // gradient placeholder for now, screenshot later
     tags: string[];
   }

   export const TEMPLATES: Template[] = [
     {
       id: 'tokyo-ramen',
       name: 'Tokyo Ramen Shop',
       description: 'Moody editorial menu with dark theme',
       industry: 'restaurant',
       prompt: 'A Tokyo ramen shop called Ichiban with a moody, editorial menu layout. Dark background, warm amber accents, Japanese typography influence. Include menu with categories, location info, and hours.',
       tags: ['restaurant', 'dark', 'editorial'],
     },
     {
       id: 'architect-portfolio',
       name: 'Architect Portfolio',
       description: 'Brutalist design with raw concrete vibes',
       industry: 'portfolio',
       prompt: 'A brutalist architect portfolio for Studio Forme. Raw concrete aesthetic, bold typography, asymmetric grid layout for projects. Include project gallery, about section, and contact.',
       tags: ['portfolio', 'brutalist', 'minimal'],
     },
     // ... 8-10 more covering key industries:
     // SaaS landing, fitness studio, law firm, coffee shop, photographer,
     // wedding planner, real estate, medical practice
   ];
   ```

   Write 10 total templates with EXCELLENT prompts that showcase 16s's design diversity. Each prompt should produce a visually distinct site. Cover: restaurant, portfolio, SaaS, fitness, law, cafe, photography, wedding, real estate, medical.

10. **Templates page: /templates**
    Create src/app/templates/page.tsx:
    - Grid of template cards (3 columns desktop, 2 tablet, 1 mobile)
    - Each card: gradient bg placeholder, template name, industry tag, description
    - Filter by industry (horizontal pill bar at top)
    - Click a card → navigate to /?template=tokyo-ramen
    - On main page, detect the template param, fill the input with the template prompt, optionally auto-submit

11. **Templates in welcome screen**
    Replace the R12 showcase cards with actual template cards from the template data. "Start from a template" section below the idea pills. Show 4-6 featured templates. "See all templates →" link to /templates page.

12. **Template attribution**
    When a project is started from a template, save `{ startedFrom: templateId }` in the project context. This lets you track which templates are popular (via analytics).

### P3 — DEPLOYMENT HISTORY & ROLLBACK (cycles 13-15)
Users deploy, then keep iterating. They need to see past deployments and roll back.

13. **Deployment history UI**
    In the preview toolbar or a slide-out panel:
    - List past deployments for the current project (from deployments table)
    - Each entry: URL, timestamp, status badge
    - "Revert to this version" button that restores the html_snapshot from that deployment to current_preview
    - Limit to last 10 deployments

14. **Deployment comparison**
    When hovering a past deployment in the list, show a small tooltip preview (just the URL as a link, or a mini-iframe if feasible). Users should be able to open any past deployment URL.

15. **Auto-deploy on publish**
    Add a "Publish changes" button that appears when the current preview differs from the latest deployment. This is a softer UX than the current deploy button — it implies "update your live site" rather than "create a new deployment."

### VERIFICATION
After each change:
1. npm run build + npm test pass
2. For schema changes: include migration SQL in commit
3. For API routes: test with curl
4. For UI: spot-check in browser
