-- Add columns for archived item info and color mode
ALTER TABLE public.quick_notes 
ADD COLUMN IF NOT EXISTS task_archived_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS decision_archived_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meeting_archived_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS color_full_card BOOLEAN DEFAULT false;

-- Add RLS policy for shared notes with edit permission
CREATE POLICY "Shared users with edit permission can update notes"
ON public.quick_notes
FOR UPDATE
USING (
  id IN (
    SELECT note_id FROM public.quick_note_shares 
    WHERE shared_with_user_id = auth.uid() 
    AND permission_type = 'edit'
  )
)
WITH CHECK (
  id IN (
    SELECT note_id FROM public.quick_note_shares 
    WHERE shared_with_user_id = auth.uid() 
    AND permission_type = 'edit'
  )
);