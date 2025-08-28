-- Fix event_plannings SELECT policy to include tenant filtering
DROP POLICY IF EXISTS "Users can view event plannings" ON public.event_plannings;

CREATE POLICY "Users can view event plannings" 
ON public.event_plannings 
FOR SELECT 
USING (
  -- User must be in the same tenant as the planning
  (tenant_id = ANY (get_user_tenant_ids(auth.uid()))) 
  AND 
  (
    -- Then apply the existing visibility rules
    (user_id = auth.uid()) OR 
    (NOT is_private) OR 
    (EXISTS ( 
      SELECT 1
      FROM event_planning_collaborators epc
      WHERE epc.event_planning_id = event_plannings.id 
      AND epc.user_id = auth.uid()
    ))
  )
);