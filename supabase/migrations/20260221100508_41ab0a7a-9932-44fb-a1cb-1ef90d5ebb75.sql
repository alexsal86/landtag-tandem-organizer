-- Add assigned_to column to starred_appointments for per-appointment assignment
ALTER TABLE public.starred_appointments ADD COLUMN assigned_to text[] DEFAULT NULL;

COMMENT ON COLUMN public.starred_appointments.assigned_to IS 'Optional array of user IDs assigned to handle this starred appointment. NULL means all participants.';
