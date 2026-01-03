-- Add priority level and follow-up date columns to quick_notes
ALTER TABLE public.quick_notes 
  ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE;

-- Add index for efficient querying by priority
CREATE INDEX IF NOT EXISTS idx_quick_notes_priority_level ON public.quick_notes(priority_level);

-- Add index for follow-up date queries
CREATE INDEX IF NOT EXISTS idx_quick_notes_follow_up_date ON public.quick_notes(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.quick_notes.priority_level IS 'Priority level: 0 = no priority, 1 = Level 1 (highest), 2 = Level 2, etc.';
COMMENT ON COLUMN public.quick_notes.follow_up_date IS 'Date when this note should be followed up on';