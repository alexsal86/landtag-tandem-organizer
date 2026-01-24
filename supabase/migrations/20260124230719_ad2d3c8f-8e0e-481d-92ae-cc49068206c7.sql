-- Add decision_id column to quick_notes table
ALTER TABLE quick_notes 
ADD COLUMN decision_id UUID REFERENCES task_decisions(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_quick_notes_decision_id ON quick_notes(decision_id) WHERE decision_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN quick_notes.decision_id IS 'Links the note to a decision request created from this note';