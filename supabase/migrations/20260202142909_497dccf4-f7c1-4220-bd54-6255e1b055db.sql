-- Fix: Change meeting_participants.user_id to reference profiles(user_id) instead of profiles(id)
-- This fixes the foreign key constraint error when adding participants

-- Step 1: Drop existing constraint
ALTER TABLE public.meeting_participants 
DROP CONSTRAINT IF EXISTS meeting_participants_user_id_fkey;

-- Step 2: Add correct constraint referencing profiles.user_id
ALTER TABLE public.meeting_participants 
ADD CONSTRAINT meeting_participants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;