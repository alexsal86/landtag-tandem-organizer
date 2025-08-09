-- Fix infinite recursion in event_planning_collaborators policies
-- Drop all existing policies for event_planning_collaborators
DROP POLICY IF EXISTS "Users can view collaborators of accessible plannings" ON public.event_planning_collaborators;
DROP POLICY IF EXISTS "Planning owners can manage collaborators" ON public.event_planning_collaborators;

-- Create simpler, non-recursive policies
CREATE POLICY "Users can view collaborators for their own plannings" 
ON public.event_planning_collaborators 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id AND ep.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own collaborator records" 
ON public.event_planning_collaborators 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Planning owners can manage collaborators" 
ON public.event_planning_collaborators 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id AND ep.user_id = auth.uid()
  )
);