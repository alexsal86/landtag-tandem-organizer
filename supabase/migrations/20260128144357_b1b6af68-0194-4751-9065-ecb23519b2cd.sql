-- Add archive columns to event_plannings
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create index for faster queries on archived plannings
CREATE INDEX IF NOT EXISTS idx_event_plannings_is_archived ON event_plannings(is_archived);