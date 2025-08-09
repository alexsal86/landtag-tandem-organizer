-- Fix the RLS policies for event_plannings table
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Users can view plannings they created or collaborate on" ON public.event_plannings;
DROP POLICY IF EXISTS "Users can update plannings they created or can edit" ON public.event_plannings;

-- Create corrected policies
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