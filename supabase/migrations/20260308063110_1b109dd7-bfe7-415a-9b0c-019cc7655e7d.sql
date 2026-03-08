
-- Add meeting_id and pending_for_jour_fixe to case_items
ALTER TABLE public.case_items
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_for_jour_fixe boolean NOT NULL DEFAULT false;

-- Index for efficient meeting lookup
CREATE INDEX IF NOT EXISTS idx_case_items_meeting_id ON public.case_items(meeting_id) WHERE meeting_id IS NOT NULL;

-- Index for pending jour fixe lookup
CREATE INDEX IF NOT EXISTS idx_case_items_pending_jour_fixe ON public.case_items(tenant_id) WHERE pending_for_jour_fixe = true;
