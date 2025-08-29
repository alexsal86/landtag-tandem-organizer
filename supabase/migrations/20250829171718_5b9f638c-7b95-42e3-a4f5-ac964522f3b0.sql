-- Create notification navigation mapping table
CREATE TABLE public.notification_navigation_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type_name TEXT NOT NULL,
  navigation_context TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new table
ALTER TABLE public.notification_navigation_mapping ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for notification_navigation_mapping
CREATE POLICY "Authenticated users can view notification navigation mapping"
ON public.notification_navigation_mapping
FOR SELECT
USING (auth.role() = 'authenticated');

-- Insert default navigation mappings
INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context) VALUES
('task_created', 'tasks'),
('task_assigned', 'tasks'),
('task_updated', 'tasks'),
('appointment_reminder', 'calendar'),
('message_received', 'messages'),
('meeting_created', 'meetings'),
('document_created', 'documents'),
('knowledge_document_created', 'knowledge');