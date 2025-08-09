-- Add unique constraint on meeting_id in appointments table
-- This is needed for the ON CONFLICT clause in handle_meeting_insert function
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_meeting_id_unique 
UNIQUE (meeting_id);