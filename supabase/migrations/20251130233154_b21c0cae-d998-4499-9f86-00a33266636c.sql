-- Add archive fields to quick_notes table
ALTER TABLE quick_notes 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance when filtering archived notes
CREATE INDEX IF NOT EXISTS idx_quick_notes_is_archived ON quick_notes(is_archived);