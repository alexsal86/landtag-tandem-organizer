
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

DROP POLICY IF EXISTS "All users can view task documents" ON storage.objects;
DROP POLICY IF EXISTS "All users can upload task documents" ON storage.objects;
DROP POLICY IF EXISTS "All users can delete task documents" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can view letter attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update letter attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete letter attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload letter attachments" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can read rate limits" ON public.widget_rate_limits;

DROP POLICY IF EXISTS "Users can view status history for accessible case files" ON public.case_file_status_history;
CREATE POLICY "Tenant members can view case file status history"
ON public.case_file_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.case_files cf
    JOIN public.profiles p ON p.tenant_id = cf.tenant_id
    WHERE cf.id = case_file_status_history.case_file_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authentifizierte Benutzer können Themen lesen" ON public.task_decision_topics;
CREATE POLICY "Users can view topics for accessible decisions"
ON public.task_decision_topics FOR SELECT
TO authenticated
USING (
  public.user_can_access_task_decision(decision_id, auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.task_decision_comment_reactions;
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.task_decision_comment_reactions;
CREATE POLICY "Users can view reactions for accessible decisions"
ON public.task_decision_comment_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.task_decision_comments c
    WHERE c.id = task_decision_comment_reactions.comment_id
      AND public.can_access_decision(c.decision_id, auth.uid())
  )
);
