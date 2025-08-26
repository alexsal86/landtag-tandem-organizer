-- Fix RLS policies for external calendars and events to be user-specific
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create all external calendars" ON public.external_calendars;
DROP POLICY IF EXISTS "Authenticated users can view all external calendars" ON public.external_calendars;
DROP POLICY IF EXISTS "Authenticated users can update all external calendars" ON public.external_calendars;
DROP POLICY IF EXISTS "Authenticated users can delete all external calendars" ON public.external_calendars;

DROP POLICY IF EXISTS "Authenticated users can create all external events" ON public.external_events;
DROP POLICY IF EXISTS "Authenticated users can view all external events" ON public.external_events;
DROP POLICY IF EXISTS "Authenticated users can update all external events" ON public.external_events;
DROP POLICY IF EXISTS "Authenticated users can delete all external events" ON public.external_events;

-- Create user-specific policies for external_calendars
CREATE POLICY "Users can create their own external calendars" 
ON public.external_calendars 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own external calendars" 
ON public.external_calendars 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own external calendars" 
ON public.external_calendars 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external calendars" 
ON public.external_calendars 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can manage all external calendars (for sync functions)
CREATE POLICY "Service role can manage all external calendars"
ON public.external_calendars
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create user-specific policies for external_events that also allow service role
CREATE POLICY "Users can view external events from their calendars" 
ON public.external_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.external_calendars ec
    WHERE ec.id = external_events.external_calendar_id 
    AND ec.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all external events"
ON public.external_events
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');