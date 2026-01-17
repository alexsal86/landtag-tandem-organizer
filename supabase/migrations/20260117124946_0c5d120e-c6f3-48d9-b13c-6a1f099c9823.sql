-- Add auto_create_count column to meeting_templates for recurring meeting instances
ALTER TABLE public.meeting_templates 
  ADD COLUMN IF NOT EXISTS auto_create_count INTEGER DEFAULT 3;

COMMENT ON COLUMN public.meeting_templates.auto_create_count 
  IS 'Number of future meeting instances to keep open for recurring meetings';

-- Add index for faster queries when checking recurring meetings
CREATE INDEX IF NOT EXISTS idx_meetings_template_status_date 
  ON public.meetings (template_id, status, meeting_date) 
  WHERE status = 'planned';