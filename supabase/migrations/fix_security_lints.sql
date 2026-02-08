-- Fix Supabase Security Linter findings
-- Run this in the Supabase SQL Editor

-- ============================================================================
-- 1. FIX FUNCTION SEARCH PATH (WARN: function_search_path_mutable)
-- ============================================================================
-- Set search_path to prevent search path injection attacks

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, status, credits_remaining)
  VALUES (NEW.id, 'free', 'active', 50);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. DROP LEGACY PRISMA/NEXTAUTH TABLES (ERROR: rls_disabled_in_public)
-- ============================================================================
-- These PascalCase tables are from a previous Prisma/NextAuth setup.
-- They are NOT used by the 16s app (which uses: projects, deployments,
-- subscriptions, usage, form_submissions, domains).
--
-- If you want to KEEP these tables instead, replace DROP with:
--   ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;
--
-- Drop in dependency order (foreign keys first):

DROP TABLE IF EXISTS "Message" CASCADE;
DROP TABLE IF EXISTS "CodeFile" CASCADE;
DROP TABLE IF EXISTS "AgentTask" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
