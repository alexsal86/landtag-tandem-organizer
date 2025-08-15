-- Create task_statuses table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies for task_statuses (similar to existing patterns)
CREATE POLICY "Admin roles can manage task statuses" 
ON public.task_statuses 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

CREATE POLICY "Authenticated users can view task statuses" 
ON public.task_statuses 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

-- Add default task statuses if table is empty
INSERT INTO public.task_statuses (name, label, order_index) 
SELECT 'todo', 'Zu erledigen', 0
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = 'todo');

INSERT INTO public.task_statuses (name, label, order_index) 
SELECT 'in_progress', 'In Bearbeitung', 1
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = 'in_progress');

INSERT INTO public.task_statuses (name, label, order_index) 
SELECT 'completed', 'Erledigt', 2
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = 'completed');

INSERT INTO public.task_statuses (name, label, order_index) 
SELECT 'cancelled', 'Abgebrochen', 3
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses WHERE name = 'cancelled');

-- Create trigger for updated_at
CREATE TRIGGER update_task_statuses_updated_at
BEFORE UPDATE ON public.task_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();