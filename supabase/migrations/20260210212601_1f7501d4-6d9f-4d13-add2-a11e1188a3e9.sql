
-- Drop the old status check constraint and replace with expanded one
ALTER TABLE public.employee_meetings DROP CONSTRAINT IF EXISTS employee_meetings_status_check;
ALTER TABLE public.employee_meetings ADD CONSTRAINT employee_meetings_status_check 
  CHECK (status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'cancelled_by_employee'::text, 'rescheduled'::text]));

-- Add cancellation_reason column
ALTER TABLE public.employee_meetings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add reschedule_reason column for employee reschedule requests
ALTER TABLE public.employee_meetings ADD COLUMN IF NOT EXISTS reschedule_request_reason TEXT;
