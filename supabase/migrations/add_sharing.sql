-- Public sharing support for projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_preview TEXT;

-- Index for public lookups
CREATE INDEX IF NOT EXISTS idx_projects_public_slug ON projects(public_slug) WHERE is_public = TRUE;

-- RLS policy: anyone can READ public projects (by slug)
-- This allows unauthenticated users to view shared projects
CREATE POLICY "Anyone can view public projects" ON projects
  FOR SELECT USING (is_public = TRUE);
