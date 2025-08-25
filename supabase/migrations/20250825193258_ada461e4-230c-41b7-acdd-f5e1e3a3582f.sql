-- Create event_planning_contacts table for multiple contact persons
CREATE TABLE public.event_planning_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'contact_person',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_planning_speakers table for speakers/presenters
CREATE TABLE public.event_planning_speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  bio TEXT,
  topic TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add digital event fields to event_plannings
ALTER TABLE public.event_plannings 
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS digital_platform TEXT,
ADD COLUMN IF NOT EXISTS digital_link TEXT,
ADD COLUMN IF NOT EXISTS digital_access_info TEXT;

-- Migrate existing contact_person data to new contacts table
INSERT INTO public.event_planning_contacts (event_planning_id, name, role)
SELECT id, contact_person, 'contact_person'
FROM public.event_plannings 
WHERE contact_person IS NOT NULL AND contact_person != '';

-- Enable RLS on new tables
ALTER TABLE public.event_planning_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_speakers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for event_planning_contacts
CREATE POLICY "Users can view contacts of accessible plannings" 
ON public.event_planning_contacts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_contacts.event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR NOT ep.is_private 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can manage contacts of editable plannings" 
ON public.event_planning_contacts 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_contacts.event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
);

-- Create RLS policies for event_planning_speakers
CREATE POLICY "Users can view speakers of accessible plannings" 
ON public.event_planning_speakers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_speakers.event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR NOT ep.is_private 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can manage speakers of editable plannings" 
ON public.event_planning_speakers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_speakers.event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
);

-- Create update triggers for timestamps
CREATE TRIGGER update_event_planning_contacts_updated_at
  BEFORE UPDATE ON public.event_planning_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_planning_speakers_updated_at
  BEFORE UPDATE ON public.event_planning_speakers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();