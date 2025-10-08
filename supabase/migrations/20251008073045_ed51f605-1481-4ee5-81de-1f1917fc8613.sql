-- Add protocol_data column to employee_meetings
ALTER TABLE public.employee_meetings 
ADD COLUMN IF NOT EXISTS protocol_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.employee_meetings.protocol_data IS 'Structured protocol data with all meeting sections';
