-- Allow meeting participants to update meeting_result on quick_notes
CREATE POLICY "Meeting participants can update note results"
  ON public.quick_notes FOR UPDATE
  USING (
    meeting_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM meeting_participants mp
        WHERE mp.meeting_id = quick_notes.meeting_id
        AND mp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = quick_notes.meeting_id
        AND m.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    meeting_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM meeting_participants mp
        WHERE mp.meeting_id = quick_notes.meeting_id
        AND mp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = quick_notes.meeting_id
        AND m.user_id = auth.uid()
      )
    )
  );