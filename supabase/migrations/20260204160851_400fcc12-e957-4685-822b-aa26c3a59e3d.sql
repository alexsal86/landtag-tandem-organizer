-- 1. Add is_completed and completed_at to event_plannings
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Add meeting_id and pending_for_jour_fixe to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_for_jour_fixe BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_pending_jour_fixe ON tasks(pending_for_jour_fixe) WHERE pending_for_jour_fixe = true;