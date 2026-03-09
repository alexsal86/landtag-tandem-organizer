-- Add Jour Fixe columns to task_decisions
ALTER TABLE public.task_decisions
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_for_jour_fixe boolean NOT NULL DEFAULT false;

-- Index for meeting lookups
CREATE INDEX IF NOT EXISTS idx_task_decisions_meeting_id ON public.task_decisions(meeting_id) WHERE meeting_id IS NOT NULL;