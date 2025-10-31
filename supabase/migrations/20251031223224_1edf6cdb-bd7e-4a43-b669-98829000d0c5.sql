-- Fix RLS policy for event_planning_dates to include WITH CHECK clause
DROP POLICY IF EXISTS "Users can manage dates of editable plannings" ON event_planning_dates;

CREATE POLICY "Users can manage dates of editable plannings"
ON event_planning_dates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM event_plannings ep
    WHERE ep.id = event_planning_dates.event_planning_id
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
    SELECT 1 FROM event_plannings ep
    WHERE ep.id = event_planning_dates.event_planning_id
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