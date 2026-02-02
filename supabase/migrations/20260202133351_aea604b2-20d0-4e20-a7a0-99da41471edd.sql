-- Add is_public column to meetings
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Update RLS policy for viewing meetings to include participants and public meetings
DROP POLICY IF EXISTS "Users can view own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view meetings they own, participate in, or are public" ON public.meetings;

CREATE POLICY "Users can view meetings they own, participate in, or are public"
ON public.meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM public.meeting_participants mp 
    WHERE mp.meeting_id = meetings.id 
    AND mp.user_id = auth.uid()
  )
);

-- Policy for meeting_agenda_items (only participants can see agenda of private meetings)
DROP POLICY IF EXISTS "Users can view agenda items of their meetings" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Users can view agenda items of accessible meetings" ON public.meeting_agenda_items;

CREATE POLICY "Users can view agenda items of accessible meetings"
ON public.meeting_agenda_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_items.meeting_id
    AND (
      m.user_id = auth.uid()
      OR m.is_public = true
      OR EXISTS (
        SELECT 1 FROM public.meeting_participants mp 
        WHERE mp.meeting_id = m.id 
        AND mp.user_id = auth.uid()
      )
    )
  )
);