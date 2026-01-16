-- Add column for pending Jour Fixe notes
ALTER TABLE public.quick_notes 
  ADD COLUMN IF NOT EXISTS pending_for_jour_fixe BOOLEAN DEFAULT FALSE;

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_quick_notes_pending_jf 
  ON public.quick_notes(pending_for_jour_fixe) 
  WHERE pending_for_jour_fixe = true;

COMMENT ON COLUMN public.quick_notes.pending_for_jour_fixe 
  IS 'If true, note will be automatically assigned to the next created Jour Fixe';