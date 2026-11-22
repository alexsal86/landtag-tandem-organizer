-- Own root responses can be withdrawn while the decision is open.
-- Child discussion responses follow their root through the existing cascading FK.
DROP POLICY IF EXISTS "Participants can withdraw own open decision response" ON public.task_decision_responses;
CREATE POLICY "Participants can withdraw own open decision response"
ON public.task_decision_responses FOR DELETE TO authenticated
USING (
  parent_response_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.task_decision_participants p
    JOIN public.task_decisions d ON d.id = p.decision_id
    JOIN public.user_tenant_memberships m ON m.tenant_id = d.tenant_id
      AND m.user_id = auth.uid() AND m.is_active
    WHERE p.id = task_decision_responses.participant_id
      AND p.decision_id = task_decision_responses.decision_id
      AND p.user_id = auth.uid()
      AND d.status IN ('active','open')
  )
);
GRANT DELETE ON public.task_decision_responses TO authenticated;
