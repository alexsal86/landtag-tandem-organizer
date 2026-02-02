-- Fix meeting_participants RLS policies - remove broken ones and add correct ones with WITH CHECK

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can manage meeting participants for their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can manage participants of their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view meeting participants for their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view participants of their meetings" ON meeting_participants;

-- 1. SELECT: Meeting creator, participant themselves, or public meeting
CREATE POLICY "Users can view meeting participants"
ON meeting_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_meeting_participant(meeting_id)
  OR EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND (m.user_id = auth.uid() OR m.is_public = true)
  )
);

-- 2. INSERT: Only meeting creator can add participants (WITH CHECK is critical!)
CREATE POLICY "Meeting creators can add participants"
ON meeting_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_id 
    AND m.user_id = auth.uid()
  )
);

-- 3. UPDATE: Meeting creator or participant themselves
CREATE POLICY "Users can update participant records"
ON meeting_participants FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_id 
    AND m.user_id = auth.uid()
  )
);

-- 4. DELETE: Only meeting creator
CREATE POLICY "Meeting creators can remove participants"
ON meeting_participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND m.user_id = auth.uid()
  )
);