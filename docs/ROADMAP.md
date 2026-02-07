# 16s Product Roadmap

## Current State
16s is a voice-first AI web designer focused on **design quality** and **pixel-perfect cloning**.

### Unique Advantages to Preserve
- **Voice-first building** - Real-time voice conversations with AI
- **Pixel-perfect inspo cloning** - Forensic 4-phase analysis
- **Anti-AI aesthetic rules** - Explicit banned patterns
- **Background removal** - Built-in image processing
- **Website-focused** - Not trying to be everything (simpler mental model)
- **Design quality emphasis** - Typography forensics, exact hex codes

---

## Priority Tiers

### P0 - MUST HAVE FOR MVP (Blocking adoption)

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|--------------|
| User Authentication | Auth for 16s platform (Clerk/Auth.js) | Medium | None |
| Cloud Project Storage | Replace localStorage with Supabase | Medium | Auth |
| Backend Integration | Supabase for generated apps | High | Auth |
| Generated App Auth | User auth in exported sites | High | Backend |
| One-Click Deploy | Deploy to Vercel/hosting | Medium | Cloud Storage |
| Custom Domains | Connect user domains | Medium | Deploy |
| Billing System | Stripe subscriptions | High | Auth |

### P1 - HIGH PRIORITY (Table stakes)

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|--------------|
| React/TypeScript Generation | Generate React code, not just HTML | High | None |
| GitHub Integration | Connect repos, auto-commit | Medium | Auth |
| Stripe for Generated Apps | Payment processing in sites | High | Backend |
| Email Integration | Transactional emails | Medium | Backend |
| Real-time Collaboration | Live cursors, multi-user | Very High | Auth, Cloud |
| Code View/Edit | Edit generated code directly | Medium | None |

### P2 - MEDIUM PRIORITY (Competitive edge)

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|--------------|
| Multiple AI Models | GPT-4, Gemini options | Low | None |
| Discussion Mode | Brainstorm without code | Low | None |
| Analytics Dashboard | Track generated site metrics | Medium | Backend |
| Figma Import | Import Figma designs | High | None |
| Visual Theme Editor | Point-click color/typography | Medium | None |
| Team Workspaces | Org management | High | Auth, Billing |

### P3 - NICE TO HAVE

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|--------------|
| Webhook/Zapier | External integrations | Medium | Backend |
| Community Showcase | Gallery of sites | Medium | Auth |
| Template Marketplace | Buy/sell templates | High | Auth, Billing |
| Advanced Testing | QA automation | High | Deploy |
| SSO | Enterprise auth | Medium | Auth |

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal: User accounts and cloud storage**

```
1. Supabase Setup
   - Create Supabase project
   - Define database schema (users, projects, versions)
   - Set up Row Level Security

2. Authentication (Clerk or Supabase Auth)
   - Sign up / Sign in flows
   - OAuth (Google, GitHub)
   - Protected routes

3. Cloud Project Storage
   - Migrate from localStorage
   - Real-time sync
   - Project sharing
```

### Phase 2: Deployment (Weeks 3-4)
**Goal: Ship sites to production**

```
4. Vercel Integration
   - Deploy API integration
   - Project creation from HTML
   - Deployment status tracking

5. Custom Domains
   - Domain verification
   - DNS instructions
   - SSL auto-provisioning

6. Preview Environments
   - Staging URLs
   - Share preview links
```

### Phase 3: Monetization (Weeks 5-6)
**Goal: Revenue infrastructure**

```
7. Stripe Integration
   - Subscription plans (Free, Pro, Team)
   - Usage-based billing option
   - Customer portal

8. Credit System
   - Message/generation credits
   - Usage tracking
   - Overage handling
```

### Phase 4: Code Quality (Weeks 7-8)
**Goal: Professional output**

```
9. React/TypeScript Generation
   - Component-based output
   - Tailwind CSS
   - shadcn/ui components

10. Code Editor
    - Monaco editor integration
    - Syntax highlighting
    - Live preview sync
```

### Phase 5: Collaboration (Weeks 9-10)
**Goal: Team features**

```
11. GitHub Integration
    - Repository connection
    - Auto-commit on changes
    - Branch management

12. Real-time Collaboration
    - Presence indicators
    - Cursor tracking
    - Conflict resolution
```

### Phase 6: Backend for Generated Apps (Weeks 11-12)
**Goal: Full-stack capabilities**

```
13. Database Schema Generation
    - Conversation-driven schema
    - Supabase table creation
    - Auto-generated CRUD

14. Auth for Generated Apps
    - User management UI
    - Session handling
    - Protected routes

15. Stripe for Generated Apps
    - Payment flows
    - Subscription management
    - Checkout integration
```

---

## Database Schema (Supabase)

```sql
-- Users (handled by Supabase Auth)

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  messages JSONB DEFAULT '[]',
  current_preview TEXT,
  preview_history JSONB DEFAULT '[]',
  bookmarks JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployments
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vercel_deployment_id TEXT,
  url TEXT,
  custom_domain TEXT,
  status TEXT DEFAULT 'pending',
  html_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  credits_remaining INTEGER DEFAULT 100,
  credits_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  credits_used INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own deployments" ON deployments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON usage
  FOR SELECT USING (auth.uid() = user_id);
```

---

## Pricing Tiers (Proposed)

| Tier | Price | Credits/mo | Projects | Deployments | Features |
|------|-------|------------|----------|-------------|----------|
| Free | $0 | 50 | 3 | 1 | Basic features |
| Pro | $20/mo | 500 | Unlimited | 10 | Custom domains, priority |
| Team | $50/mo | 2000 | Unlimited | Unlimited | Collaboration, analytics |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | SSO, SLA, support |

---

## Tech Stack Additions

### Backend
- **Supabase** - Database, Auth, Storage, Edge Functions
- **Vercel API** - Deployment automation
- **Stripe** - Payments and subscriptions

### Frontend Additions
- **Clerk** or **Supabase Auth** - User authentication
- **Monaco Editor** - Code editing
- **Yjs** - Real-time collaboration (CRDT)

### Generated App Stack
- **React + Vite** - Frontend framework
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Supabase JS** - Backend integration

---

## Success Metrics

### Phase 1-2
- [ ] 100 users signed up
- [ ] 50 projects saved to cloud
- [ ] 20 sites deployed

### Phase 3-4
- [ ] 10 paying customers
- [ ] $500 MRR
- [ ] 80% code quality score

### Phase 5-6
- [ ] 5 teams using collaboration
- [ ] 10 full-stack apps deployed
- [ ] 50% week-over-week growth

---

## Competitors Reference

| Feature | Lovable | Base44 | vly.ai | 16s (Current) | 16s (Target) |
|---------|---------|--------|--------|---------------|--------------|
| AI Design | ✅ | ✅ | ✅ | ✅ Best-in-class | ✅ |
| Voice Building | ❌ | ❌ | ❌ | ✅ Unique | ✅ |
| Inspo Cloning | Partial | Partial | ❌ | ✅ Best-in-class | ✅ |
| React Output | ✅ | ✅ | ✅ | ❌ HTML only | ✅ |
| User Auth | ✅ | ✅ | ✅ | ❌ | ✅ |
| Cloud Storage | ✅ | ✅ | ✅ | ❌ localStorage | ✅ |
| Deployment | ✅ | ✅ | ✅ | ❌ | ✅ |
| Database | ✅ Supabase | ✅ Built-in | ✅ Convex | ❌ | ✅ |
| Payments | ✅ | ✅ | ✅ | ❌ | ✅ |
| Collaboration | ✅ | ✅ | ❌ | ❌ | ✅ |
| GitHub Sync | ✅ | ❌ | ✅ | ❌ | ✅ |

---

## Next Steps

1. **Decide Phase 1 scope** - Auth + Cloud Storage
2. **Set up Supabase project** - Database and auth
3. **Implement auth flows** - Sign up, sign in, protected routes
4. **Migrate project storage** - localStorage → Supabase
5. **Build deployment pipeline** - Vercel API integration
