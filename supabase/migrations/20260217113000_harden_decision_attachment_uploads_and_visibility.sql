-- Make MIME handling robust: rely on app-side validation, do not block uploads by bucket mime allow-list
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'decision-attachments';

-- Ensure attachments of tenant-wide visible decisions are also readable via storage policies
DROP POLICY IF EXISTS "Users can view decision attachments they have access to" ON storage.objects;

CREATE POLICY "Users can view decision attachments they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    -- Own files
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Files from decisions they participate in
    EXISTS (
      SELECT 1 FROM public.task_decision_participants tdp
      JOIN public.task_decision_attachments tda ON tda.decision_id = tdp.decision_id
      WHERE tda.file_path = name
      AND tdp.user_id = auth.uid()
    )
    OR
    -- Files from own decisions
    EXISTS (
      SELECT 1 FROM public.task_decisions td
      JOIN public.task_decision_attachments tda ON tda.decision_id = td.id
      WHERE tda.file_path = name
      AND td.created_by = auth.uid()
    )
    OR
    -- Files from visible-to-all decisions in the same tenant
    EXISTS (
      SELECT 1
      FROM public.task_decisions td
      JOIN public.task_decision_attachments tda ON tda.decision_id = td.id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
      WHERE tda.file_path = name
        AND td.visible_to_all = true
        AND utm.user_id = auth.uid()
        AND utm.is_active = true
    )
  )
);
