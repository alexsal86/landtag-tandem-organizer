-- Fix checklist RLS policy to include WITH CHECK for UPDATE operations
DROP POLICY IF EXISTS "Users can manage checklist items of editable plannings" 
ON public.event_planning_checklist_items;

-- Recreate with explicit WITH CHECK clause
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
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
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