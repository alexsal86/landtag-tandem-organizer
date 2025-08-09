-- Create event plannings table
CREATE TABLE public.event_plannings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  contact_person TEXT,
  background_info TEXT,
  confirmed_date TIMESTAMP WITH TIME ZONE,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collaborators table for permission management
CREATE TABLE public.event_planning_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_planning_id, user_id)
);

-- Create optional dates table
CREATE TABLE public.event_planning_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checklist items table
CREATE TABLE public.event_planning_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_plannings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_plannings
CREATE POLICY "Users can view plannings they created or collaborate on" 
ON public.event_plannings 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR NOT is_private 
  OR EXISTS (
    SELECT 1 FROM public.event_planning_collaborators epc 
    WHERE epc.event_planning_id = id AND epc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own plannings" 
ON public.event_plannings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update plannings they created or can edit" 
ON public.event_plannings 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.event_planning_collaborators epc 
    WHERE epc.event_planning_id = id AND epc.user_id = auth.uid() AND epc.can_edit = true
  )
);

CREATE POLICY "Users can delete their own plannings" 
ON public.event_plannings 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for collaborators
CREATE POLICY "Users can view collaborators of accessible plannings" 
ON public.event_planning_collaborators 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR NOT ep.is_private 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc2 
        WHERE epc2.event_planning_id = ep.id AND epc2.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Planning owners can manage collaborators" 
ON public.event_planning_collaborators 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id AND ep.user_id = auth.uid()
  )
);

-- RLS Policies for dates
CREATE POLICY "Users can view dates of accessible plannings" 
ON public.event_planning_dates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR NOT ep.is_private 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can manage dates of editable plannings" 
ON public.event_planning_dates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
      )
    )
  )
);

-- RLS Policies for checklist items
CREATE POLICY "Users can view checklist items of accessible plannings" 
ON public.event_planning_checklist_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR NOT ep.is_private 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can manage checklist items of editable plannings" 
ON public.event_planning_checklist_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
      )
    )
  )
);

-- Create default checklist items function
CREATE OR REPLACE FUNCTION public.create_default_checklist_items(planning_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.event_planning_checklist_items (event_planning_id, title, order_index) VALUES
    (planning_id, 'Social Media geplant', 0),
    (planning_id, 'Begleitung erwünscht', 1),
    (planning_id, 'Information an Kreisverband', 2),
    (planning_id, 'Information an Gemeinderatsfraktion', 3),
    (planning_id, 'Information an Abgeordnete', 4),
    (planning_id, 'Pressemitteilung vorbereitet', 5),
    (planning_id, 'Technik überprüft', 6),
    (planning_id, 'Catering organisiert', 7),
    (planning_id, 'Einladungen verschickt', 8),
    (planning_id, 'Nachbereitung geplant', 9);
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_event_plannings_updated_at
BEFORE UPDATE ON public.event_plannings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_planning_checklist_items_updated_at
BEFORE UPDATE ON public.event_planning_checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();