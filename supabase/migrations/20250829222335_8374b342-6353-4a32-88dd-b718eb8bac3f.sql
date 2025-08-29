-- Enable RLS policies for event_plannings table
CREATE POLICY "Users can view their own event plannings" 
ON public.event_plannings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own event plannings" 
ON public.event_plannings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own event plannings" 
ON public.event_plannings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own event plannings" 
ON public.event_plannings 
FOR DELETE 
USING (auth.uid() = user_id);