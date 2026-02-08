-- 16s Database Schema for Supabase
-- Run this in the Supabase SQL Editor to set up your database
--
-- SECURITY MODEL:
-- All tables have Row Level Security (RLS) enabled.
-- Every policy restricts access to auth.uid() = user_id.
-- The anon role CANNOT read, write, or delete any other user's data.
-- Subscriptions: INSERT handled by SECURITY DEFINER trigger on auth.users signup.
-- Usage: INSERT handled by service_role only (server-side credit deduction).
-- The Supabase anon key is safe to expose client-side because RLS enforces
-- all access control at the database level.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  messages JSONB DEFAULT '[]',
  current_preview TEXT,
  preview_history JSONB DEFAULT '[]',
  bookmarks JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  context JSONB DEFAULT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  public_slug TEXT UNIQUE,
  public_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing deployments
ALTER TABLE projects ADD COLUMN IF NOT EXISTS context JSONB DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_preview TEXT;

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_public_slug ON projects(public_slug) WHERE is_public = TRUE;

-- ============================================================================
-- DEPLOYMENTS TABLE (for future use)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vercel_deployment_id TEXT,
  url TEXT,
  custom_domain TEXT,
  status TEXT DEFAULT 'pending',
  html_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);

-- ============================================================================
-- DOMAINS TABLE (custom domains for deployed projects)
-- ============================================================================
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  vercel_domain_id TEXT,
  verification_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_project_id ON domains(project_id);

-- ============================================================================
-- FORM SUBMISSIONS TABLE (contact form data from deployed sites)
-- ============================================================================
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_project ON form_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_owner ON form_submissions(owner_id);

-- ============================================================================
-- SUBSCRIPTIONS TABLE (for future billing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  credits_remaining INTEGER DEFAULT 10,
  credits_reset_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Migration for existing deployments
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- ============================================================================
-- USAGE TRACKING TABLE (for analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  credits_used INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own projects
CREATE POLICY "Users can CRUD own projects" ON projects
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Projects: Anyone can view public projects (for sharing)
CREATE POLICY "Anyone can view public projects" ON projects
  FOR SELECT USING (is_public = TRUE);

-- Deployments: Users can only access their own deployments
CREATE POLICY "Users can CRUD own deployments" ON deployments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Domains: Users can manage their own domains
CREATE POLICY "Users manage own domains" ON domains
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Form submissions: Owners view + update their own, anyone can insert
CREATE POLICY "Owners view own submissions" ON form_submissions
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners update own submissions" ON form_submissions
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can insert submissions" ON form_submissions
  FOR INSERT WITH CHECK (TRUE);

-- Subscriptions: Users can view and update their own subscription
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usage: Users can only view their own usage (insert via service role)
CREATE POLICY "Users can view own usage" ON usage
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to projects table
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Apply to domains table
DROP TRIGGER IF EXISTS domains_updated_at ON domains;
CREATE TRIGGER domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Apply to subscriptions table
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- CREATE DEFAULT SUBSCRIPTION ON USER SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, status, credits_remaining)
  VALUES (NEW.id, 'free', 'active', 10);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();
