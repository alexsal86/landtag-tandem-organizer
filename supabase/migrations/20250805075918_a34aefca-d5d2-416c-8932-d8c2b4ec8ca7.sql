-- Create meetings table for weekly meeting agendas
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  template_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_agenda_items table for individual agenda points
CREATE TABLE public.meeting_agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  task_id UUID,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_templates table for reusable agenda templates
CREATE TABLE public.meeting_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for meetings
CREATE POLICY "Users can view their own meetings" 
ON public.meetings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meetings" 
ON public.meetings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meetings" 
ON public.meetings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for meeting agenda items
CREATE POLICY "Users can view agenda items for their meetings" 
ON public.meeting_agenda_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_agenda_items.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can create agenda items for their meetings" 
ON public.meeting_agenda_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_agenda_items.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can update agenda items for their meetings" 
ON public.meeting_agenda_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_agenda_items.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can delete agenda items for their meetings" 
ON public.meeting_agenda_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_agenda_items.meeting_id 
  AND meetings.user_id = auth.uid()
));

-- Create policies for meeting templates
CREATE POLICY "Users can view their own meeting templates" 
ON public.meeting_templates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meeting templates" 
ON public.meeting_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting templates" 
ON public.meeting_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting templates" 
ON public.meeting_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_agenda_items_updated_at
BEFORE UPDATE ON public.meeting_agenda_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_templates_updated_at
BEFORE UPDATE ON public.meeting_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();