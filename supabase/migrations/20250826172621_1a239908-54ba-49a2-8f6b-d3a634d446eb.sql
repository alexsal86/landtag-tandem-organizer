-- Create external_calendars table
CREATE TABLE public.external_calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  ics_url TEXT NOT NULL,
  calendar_type TEXT NOT NULL DEFAULT 'google',
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_interval INTEGER NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create external_events table
CREATE TABLE public.external_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_calendar_id UUID NOT NULL REFERENCES public.external_calendars(id) ON DELETE CASCADE,
  external_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  all_day BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  raw_ics_data JSONB,
  last_modified TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(external_calendar_id, external_uid)
);

-- Enable Row Level Security
ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for external_calendars
CREATE POLICY "Authenticated users can create all external calendars" 
ON public.external_calendars 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can view all external calendars" 
ON public.external_calendars 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update all external calendars" 
ON public.external_calendars 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete all external calendars" 
ON public.external_calendars 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

-- Create RLS policies for external_events
CREATE POLICY "Authenticated users can create all external events" 
ON public.external_events 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can view all external events" 
ON public.external_events 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update all external events" 
ON public.external_events 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete all external events" 
ON public.external_events 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

-- Add trigger for updated_at on external_calendars
CREATE TRIGGER update_external_calendars_updated_at
  BEFORE UPDATE ON public.external_calendars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on external_events  
CREATE TRIGGER update_external_events_updated_at
  BEFORE UPDATE ON public.external_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();