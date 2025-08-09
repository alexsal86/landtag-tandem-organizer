-- Completely fix infinite recursion in event_plannings policies
-- Drop ALL existing policies for event_plannings
DROP POLICY IF EXISTS "Users can create their own plannings" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can delete their own plannings" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can update plannings they created or can edit" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can view plannings they created or collaborate on" ON public.event_plannings;

-- Create simple, non-recursive policies
CREATE POLICY "Users can create their own plannings" 
ON public.event_plannings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plannings" 
ON public.event_plannings 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own plannings" 
ON public.event_plannings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view non-private plannings" 
ON public.event_plannings 
FOR SELECT 
USING (NOT is_private);

CREATE POLICY "Users can update their own plannings" 
ON public.event_plannings 
FOR UPDATE 
USING (auth.uid() = user_id);