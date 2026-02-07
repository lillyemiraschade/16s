# 16s — Round 12: Performance, Onboarding & New Features

## Context
11 rounds complete (~200 changes). Architecture clean, security hardened, streaming live, 33 tests passing, CI/CD running, iframe sandboxed. The infra is solid. This round shifts focus to user experience, performance, and features that make 16s feel like a real product vs. a prototype.

## Tech Stack
Next.js 14.2, TypeScript, Tailwind, Supabase, Stripe, Anthropic Claude, Vercel Blob, Vercel hosting.

## Commands
```
npm run build
npm run dev
npm test
npm run check         # tsc + build + test
```

## Commit: [Ralph R12-N]

## BANNED (done in prior rounds)
- Prompt compression (done 50+ times)
- Dead code removal, console changes (done)
- Component splitting (done — page.tsx, ChatPanel, PreviewPanel all split)
- Rate limiter, env validation, API helpers (done)
- Security headers, CORS, CSP, sandbox (done)
- CI/CD setup (done)

## PRIORITY ORDER

### P0 — PERFORMANCE (cycles 1-5)
Three heavy dependencies are statically imported but only used conditionally. This bloats the initial bundle for every user.

1. **Lazy-load Monaco Editor**: CodeEditor.tsx imports @monaco-editor/react at the top level, but users only see it when they click the code toggle. Monaco is ~2MB.

   In PreviewPanel.tsx (or wherever CodeEditor is imported), replace:
   ```typescript
   import { CodeEditor } from "./CodeEditor";
   ```
   with:
   ```typescript
   import dynamic from 'next/dynamic';
   const CodeEditor = dynamic(() => import('./CodeEditor').then(m => ({ default: m.CodeEditor })), {
     loading: () => <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Loading editor...</div>,
     ssr: false,
   });
   ```
   This defers Monaco until the user actually opens the code view.

2. **Lazy-load html2canvas**: page.tsx (or usePreview.ts after R9) imports html2canvas at the top level. It's only used for taking screenshots before AI calls. ~400KB.

   Replace the static import with dynamic import at call site:
   ```typescript
   // Remove: import html2canvas from "html2canvas";
   // In the function that uses it:
   const html2canvas = (await import('html2canvas')).default;
   ```

3. **Lazy-load Stripe client**: @stripe/stripe-js is imported but only needed when user clicks upgrade/checkout. Verify it's already lazy — if not, make it so:
   ```typescript
   const getStripeClient = async () => {
     const { loadStripe } = await import('@stripe/stripe-js');
     return loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);
   };
   ```

4. **Lazy-load VoiceCall**: The VoiceCall component (489 lines, includes Web Speech API setup) is imported but only rendered when user starts a call. Use next/dynamic.

5. **Bundle analysis + verification**: After lazy-loading changes, run:
   ```
   npm run build
   ```
   Compare the "First Load JS" numbers from the build output before and after. Document the improvement in progress.txt. Target: <200KB first load for the main page (currently ~276KB).

### P1 — ONBOARDING (cycles 6-9)
New users land on the welcome screen and have to figure things out themselves. No guidance on what 16s can do or how to get the best results.

6. **First-visit tooltip tour**: On first visit (check localStorage flag `16s-onboarded`), show 3-4 lightweight tooltips that highlight key features:
   - Tooltip 1: Points at the input area — "Describe any website and I'll build it in seconds"
   - Tooltip 2: Points at the idea pills — "Or pick an idea to start with"
   - Tooltip 3: After first generation, points at the preview — "Your site appears here. Edit it by chatting."
   - Tooltip 4: Points at the voice call button (once visible) — "Try a voice call for a hands-free design session"

   Implementation: Create src/components/onboarding/OnboardingTooltip.tsx — a small positioned tooltip with "Got it" button and step indicator (1/4). Use absolute positioning relative to the target element. Simple framer-motion fade in/out. Set localStorage flag when dismissed.

   Keep it LIGHTWEIGHT — no full-page overlay, no modal, no video. Just subtle pointers.

7. **Welcome screen example showcase**: Below the idea pills, add a "See what 16s can build" section with 3-4 static screenshots of impressive generated sites. These should be real screenshots, but for now use placeholder div with gradient backgrounds and text labels ("Tokyo Ramen Shop", "Architect Portfolio", "SaaS Landing Page"). Later you'll replace with real screenshots.

8. **Smart first prompt handling**: When a brand new user sends their first message, the AI should be extra helpful. Add a flag in the chat request: `isFirstMessage: boolean`. In the system prompt, add:
   ```
   FIRST MESSAGE: If this is the user's first message ever, be extra warm and encouraging. Explain what will happen next. Don't overwhelm with options. Generate something impressive quickly to build trust. Skip the plan approval step on first message — just build something great.
   ```

9. **Credit counter in header**: Authenticated users should see their remaining credits in the header (near UserMenu). Small pill: "42 credits left" or "∞" for unlimited. Helps users understand the value of their subscription.

### P2 — DISCUSSION MODE (cycles 10-12)
Users sometimes want to brainstorm without generating code. Currently every message triggers a full AI response with HTML generation expectations.

10. **Discussion toggle**: Add a "Chat only" mode toggle in the chat input area. When enabled:
    - The AI responds conversationally without generating HTML
    - System prompt gets a short addendum: "DISCUSSION MODE: The user wants to chat about their project without code generation. Help them brainstorm, refine ideas, discuss design choices, and plan. Do NOT generate HTML or React code. Respond with just a message and optional pills. When they're ready to build, they'll switch back to build mode."
    - The toggle is a small icon button (MessageSquare icon from Lucide) next to the send button
    - Visual indicator when in discussion mode (different input background, label "Chat mode")
    - Persists per project (save in project settings)

11. **Discussion → Build transition**: When user switches from discussion back to build mode, the AI should receive the full conversation context and a note: "The user has been brainstorming and is now ready to build. Use the discussion context to generate code."

12. **Quick actions in discussion mode**: Add pills specific to brainstorming:
    - "Show me layout options"
    - "Compare color palettes"
    - "What sections should I include?"
    - "Ready to build!"

### P3 — ANALYTICS HOOKS (cycles 13-15)
No tracking exists. You can't know what users do, where they drop off, or what features they use.

13. **Analytics utility**: Create src/lib/analytics.ts:
    ```typescript
    type Event =
      | { name: 'page_view'; props: { page: string } }
      | { name: 'message_sent'; props: { hasImages: boolean; mode: 'build' | 'discussion' } }
      | { name: 'generation_complete'; props: { model: string; tokens: number; hasHtml: boolean } }
      | { name: 'deploy'; props: { success: boolean } }
      | { name: 'voice_call'; props: { duration: number } }
      | { name: 'image_upload'; props: { type: 'inspo' | 'content'; bgRemoved: boolean } }
      | { name: 'project_created' | 'project_loaded' | 'project_deleted' }
      | { name: 'auth_signin' | 'auth_signup' | 'auth_signout' }
      | { name: 'upgrade_clicked'; props: { from: string } }
      | { name: 'feature_used'; props: { feature: string } };

    export function track(event: Event) {
      // In development: console.debug
      // In production: send to configured endpoint
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Analytics]', event.name, event.props);
        return;
      }
      const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
      if (endpoint) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...event, timestamp: Date.now() }),
        }).catch(() => {});
      }
    }
    ```

14. **Wire analytics into key touchpoints**:
    - useChat: track message_sent, generation_complete
    - useDeployment: track deploy
    - VoiceCall: track voice_call with duration
    - useImages: track image_upload
    - useProjects: track project_created/loaded/deleted
    - AuthContext: track auth events
    - Page navigation: track page_view

    All fire-and-forget. Never block UI. Never fail visibly.

15. **Server-side generation metrics**: In the chat API route, log generation metrics:
    - Model used (Haiku vs Sonnet)
    - Token count (input + output)
    - Response time
    - Whether HTML was generated
    - Whether it was a cache hit (prompt caching)
    Store in a simple `generation_metrics` Supabase table (or just structured logs for now).

### P4 — QUALITY OF LIFE (cycles 16-18)

16. **Project duplicate**: Add a "Duplicate" button on the projects page. Copies the project with "(Copy)" appended to the name. Users want to try different directions from the same starting point.

17. **Export improvements**: Beyond HTML download, add:
    - "Copy HTML" button (already exists? verify)
    - "Download as ZIP" — index.html + any referenced images (from Vercel Blob URLs) packaged together
    - This lets users take their site to any hosting provider

18. **Keyboard shortcuts help**: Verify the shortcuts modal (Cmd+/) still works after all the refactoring. If the shortcuts changed, update the modal content.

### VERIFICATION
After each change:
1. npm run build passes
2. npm test passes
3. For performance: compare build output before/after
4. For UI: spot-check visually
