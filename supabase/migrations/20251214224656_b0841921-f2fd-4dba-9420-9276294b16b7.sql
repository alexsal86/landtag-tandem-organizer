-- Migration: Change meeting_participants from contact_id to user_id
-- Drop the existing contact_id column and add user_id

-- Remove old column and constraints
ALTER TABLE meeting_participants DROP CONSTRAINT IF EXISTS meeting_participants_meeting_contact_unique;
ALTER TABLE meeting_participants DROP COLUMN IF EXISTS contact_id;

-- Add new user_id column referencing profiles
ALTER TABLE meeting_participants ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL;

-- Add unique constraint for meeting + user
ALTER TABLE meeting_participants ADD CONSTRAINT meeting_participants_meeting_user_unique UNIQUE (meeting_id, user_id);

-- Drop old RLS policies and create new ones
DROP POLICY IF EXISTS "Users can view meeting participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can manage meeting participants" ON meeting_participants;

-- Create new RLS policies
CREATE POLICY "Users can view meeting participants for their meetings"
ON meeting_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage meeting participants for their meetings"
ON meeting_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND m.user_id = auth.uid()
  )
);