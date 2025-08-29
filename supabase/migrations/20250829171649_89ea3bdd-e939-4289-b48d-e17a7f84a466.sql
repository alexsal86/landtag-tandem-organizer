-- Create notification navigation mapping table
CREATE TABLE public.notification_navigation_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type_name TEXT NOT NULL,
  navigation_context TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate mappings
CREATE UNIQUE INDEX idx_notification_navigation_mapping_unique 
ON public.notification_navigation_mapping(notification_type_name, navigation_context);

-- Add navigation_context column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN navigation_context TEXT;

-- Create user navigation visits tracking table
CREATE TABLE public.user_navigation_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  navigation_context TEXT NOT NULL,
  last_visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for user + navigation context
CREATE UNIQUE INDEX idx_user_navigation_visits_unique 
ON public.user_navigation_visits(user_id, navigation_context);

-- Enable RLS on new tables
ALTER TABLE public.notification_navigation_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_navigation_visits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_navigation_mapping (read-only for authenticated users)
CREATE POLICY "Authenticated users can view notification navigation mapping"
ON public.notification_navigation_mapping
FOR SELECT
USING (auth.role() = 'authenticated');

-- Create RLS policies for user_navigation_visits
CREATE POLICY "Users can manage their own navigation visits"
ON public.user_navigation_visits
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

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

-- Add trigger to automatically update navigation_context when notifications are created
CREATE OR REPLACE FUNCTION public.set_notification_navigation_context()
RETURNS TRIGGER AS $$
BEGIN
  -- Set navigation_context based on notification type mapping
  SELECT navigation_context INTO NEW.navigation_context
  FROM public.notification_navigation_mapping nnm
  INNER JOIN public.notification_types nt ON nt.name = nnm.notification_type_name
  WHERE nt.id = NEW.notification_type_id
  LIMIT 1;
  
  -- If no mapping found, set to null (will show in all contexts)
  IF NEW.navigation_context IS NULL THEN
    NEW.navigation_context := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_notification_navigation_context
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_navigation_context();

-- Add trigger for updating updated_at on user_navigation_visits
CREATE TRIGGER update_user_navigation_visits_updated_at
  BEFORE UPDATE ON public.user_navigation_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();