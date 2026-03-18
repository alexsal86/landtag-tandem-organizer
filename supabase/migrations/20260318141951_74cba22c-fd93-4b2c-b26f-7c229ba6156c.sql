-- Fix event_planning_item_actions INSERT RLS policy
-- The current policy requires user_tenant_memberships, but event_plannings.tenant_id can be NULL
-- Align with event_planning_checklist_items policy (owner/collaborator pattern)

DROP POLICY IF EXISTS "Users can create actions in their tenant" ON public.event_planning_item_actions;
DROP POLICY IF EXISTS "Users can view actions in their tenant" ON public.event_planning_item_actions;
DROP POLICY IF EXISTS "Users can update actions in their tenant" ON public.event_planning_item_actions;
DROP POLICY IF EXISTS "Users can delete actions in their tenant" ON public.event_planning_item_actions;

-- New policies using owner/collaborator pattern (same as checklist_items)
CREATE POLICY "Users can manage actions of editable plannings"
ON public.event_planning_item_actions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM event_planning_checklist_items eci
    JOIN event_plannings ep ON ep.id = eci.event_planning_id
    WHERE eci.id = event_planning_item_actions.checklist_item_id
    AND (
      ep.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_planning_collaborators epc
        WHERE epc.event_planning_id = ep.id
        AND epc.user_id = auth.uid()
        AND epc.can_edit = true
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM event_planning_checklist_items eci
    JOIN event_plannings ep ON ep.id = eci.event_planning_id
    WHERE eci.id = event_planning_item_actions.checklist_item_id
    AND (
      ep.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_planning_collaborators epc
        WHERE epc.event_planning_id = ep.id
        AND epc.user_id = auth.uid()
        AND epc.can_edit = true
      )
    )
  )
);

-- Add a SELECT policy for read-only collaborators too
CREATE POLICY "Users can view actions of accessible plannings"
ON public.event_planning_item_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM event_planning_checklist_items eci
    JOIN event_plannings ep ON ep.id = eci.event_planning_id
    WHERE eci.id = event_planning_item_actions.checklist_item_id
    AND (
      ep.user_id = auth.uid()
      OR NOT ep.is_private
      OR EXISTS (
        SELECT 1 FROM event_planning_collaborators epc
        WHERE epc.event_planning_id = ep.id
        AND epc.user_id = auth.uid()
      )
    )
  )
);