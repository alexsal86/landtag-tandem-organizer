-- Create table for note version history
CREATE TABLE quick_note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES quick_notes(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL
);

-- Index for fast queries
CREATE INDEX idx_quick_note_versions_note_id ON quick_note_versions(note_id);
CREATE INDEX idx_quick_note_versions_created_at ON quick_note_versions(note_id, created_at DESC);

-- RLS Policies
ALTER TABLE quick_note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own note versions"
  ON quick_note_versions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own note versions"
  ON quick_note_versions FOR INSERT
  WITH CHECK (user_id = auth.uid());