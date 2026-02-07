-- Allow meeting participants, creators, and public meeting viewers to see linked quick notes
CREATE POLICY "Meeting participants can view linked notes"
ON public.quick_notes
FOR SELECT
USING (
  meeting_id IS NOT NULL
  AND (
    -- User is a participant of the meeting
    EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_participants.meeting_id = quick_notes.meeting_id
      AND meeting_participants.user_id = auth.uid()
    )
    OR
    -- User is the meeting creator OR meeting is public
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = quick_notes.meeting_id
      AND (meetings.is_public = true OR meetings.user_id = auth.uid())
    )
  )
);