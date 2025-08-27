-- Create foreign key relationship between external_calendars and profiles
ALTER TABLE public.external_calendars 
ADD CONSTRAINT external_calendars_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;