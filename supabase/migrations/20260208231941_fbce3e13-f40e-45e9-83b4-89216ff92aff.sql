
-- Add new columns for the redesigned CaseFile detail view
ALTER TABLE public.case_files
  ADD COLUMN IF NOT EXISTS current_status_note text,
  ADD COLUMN IF NOT EXISTS current_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS risks_and_opportunities jsonb DEFAULT '{"risks": [], "opportunities": []}',
  ADD COLUMN IF NOT EXISTS assigned_to uuid;
