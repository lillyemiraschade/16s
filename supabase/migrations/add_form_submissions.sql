-- Form submissions from deployed sites
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Owners can view their own submissions
CREATE POLICY "Owners view own submissions" ON form_submissions
  FOR SELECT USING (auth.uid() = owner_id);

-- Owners can update own submissions (mark as read)
CREATE POLICY "Owners update own submissions" ON form_submissions
  FOR UPDATE USING (auth.uid() = owner_id);

-- Anyone can insert (deployed sites submit forms without auth)
CREATE POLICY "Anyone can insert submissions" ON form_submissions
  FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_form_submissions_project ON form_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_owner ON form_submissions(owner_id);
