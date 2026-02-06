---
active: true
iteration: 2
max_iterations: 50
completion_promise: "ALL_DONE"
started_at: "2026-02-06T02:59:26Z"
---

You are a senior full-stack engineer and AI prompt designer doing Round 2 improvements on 16s. Round 1 made 20 changes — read CHANGELOG.md and progress.txt so you don't repeat work. Read CLAUDE.md for rules. Read SMARTER_16S_PLAN.md for product direction.

Each cycle, rotate categories: CODE → PROMPT → FEATURE → CODE → PROMPT → FEATURE.

CATEGORY A — CODE: Known issues to fix first: (1) Extract shared helper from handleSendMessage and handleSendMessageInternal in page.tsx — they have ~200 lines of identical fetch+parse logic. (2) Pin Stripe API version in src/lib/stripe/config.ts to stable release instead of future date 2026-01-28.clover. (3) Add allowTaint:true fallback and try/catch to captureScreenshot html2canvas in page.tsx. (4) Add context to beforeunload localStorage save. (5) Add aria-labels to image toggle buttons in ChatPanel.tsx. After those, audit for: dead code, unused imports, missing types, console.logs to remove, functions over 80 lines to split, any new bugs.

CATEGORY B — PROMPT: The SYSTEM_PROMPT in src/app/api/chat/route.ts is the product. Improve it: (1) Add industry templates one at a time — law firms, fitness/gyms, churches/nonprofits, salons/spas, automotive, education/tutoring. Each needs specific sections, functionality, and design tone. (2) Improve conversation flow — when first message has clear business type + name, skip questions and generate immediately. When user sends multiple changes in one message, handle all of them. When user says 'go back' or 'undo,' acknowledge what's being reverted. (3) Modernize design system — add bento grids, glassmorphism, gradient mesh, text gradients, scroll-driven animations, container queries, color-mix(), has() selector patterns. (4) Strengthen QA — add checks for touch targets >= 44px, form inputs have labels, images have width/height for CLS, external links have target=_blank rel=noopener. (5) Compress — target <13K tokens. If you add something, cut something. Remove redundant rules, verbose CSS Claude already knows, overlapping sections.

CATEGORY C — SMARTER FEATURES (small only, no new routes/tables): (1) Audit plan card generation — make sure AI generates plans for complex requests consistently. (2) Audit QA report generation — make sure reports catch real issues after full builds, not just 'looks good.' (3) Verify context persistence flow end-to-end: page.tsx saves context → API loads it → injects into prompt → AI uses it. (4) Improve pill suggestions — after generating a restaurant site, pills should be 'Add online ordering' not 'Change colors.' Make pills contextual to what was just built.

After EVERY change: run npm run build, commit with [Ralph R2] prefix, append to CHANGELOG.md (format: timestamp, category, title, what, why, files, type), update progress.txt.

Output <promise>ALL_DONE</promise> only if you genuinely cannot find anything left to improve after thoroughly auditing the entire codebase and all prompts.
