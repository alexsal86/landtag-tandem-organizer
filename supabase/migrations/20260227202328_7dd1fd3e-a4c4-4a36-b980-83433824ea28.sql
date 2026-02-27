
-- Add workflow fields for approval loop
ALTER TABLE public.letters 
  ADD COLUMN IF NOT EXISTS revision_comment text,
  ADD COLUMN IF NOT EXISTS revision_requested_by uuid,
  ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz;

-- Update status check to allow new statuses (drop old constraint if exists)
DO $$ BEGIN
  ALTER TABLE public.letters DROP CONSTRAINT IF EXISTS letters_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
