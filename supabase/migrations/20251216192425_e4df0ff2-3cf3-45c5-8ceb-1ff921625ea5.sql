-- Add meeting link columns to quick_notes
ALTER TABLE public.quick_notes ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;
ALTER TABLE public.quick_notes ADD COLUMN IF NOT EXISTS meeting_result text;
ALTER TABLE public.quick_notes ADD COLUMN IF NOT EXISTS added_to_meeting_at timestamptz;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quick_notes_meeting_id ON public.quick_notes(meeting_id);

-- Add comment
COMMENT ON COLUMN public.quick_notes.meeting_id IS 'Reference to linked Jour Fixe meeting';
COMMENT ON COLUMN public.quick_notes.meeting_result IS 'Result/notes from the meeting discussion';
COMMENT ON COLUMN public.quick_notes.added_to_meeting_at IS 'Timestamp when note was added to meeting';