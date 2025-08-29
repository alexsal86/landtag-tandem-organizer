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

-- Enable RLS on user_navigation_visits
ALTER TABLE public.user_navigation_visits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_navigation_visits
CREATE POLICY "Users can manage their own navigation visits"
ON public.user_navigation_visits
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add trigger for updating updated_at on user_navigation_visits
CREATE TRIGGER update_user_navigation_visits_updated_at
  BEFORE UPDATE ON public.user_navigation_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();