
-- Fix RLS SELECT policy for decision-attachments storage bucket
-- Problem: Files were uploaded with Tenant-ID as the root folder, but the old policy only checked auth.uid()
-- This migration replaces the policy to also allow access via DB-registered paths

DROP POLICY IF EXISTS "Users can view decision attachments they have access to" ON storage.objects;

CREATE POLICY "Users can view decision attachments they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    -- Own folder (User-ID as first segment)
    (storage.foldername(name))[1] = (auth.uid())::text
    OR
    -- File is registered in DB AND user is a participant of the decision
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decision_participants tdp ON tdp.decision_id = tda.decision_id
      WHERE tda.file_path = objects.name
        AND tdp.user_id = auth.uid()
    )
    OR
    -- File is registered in DB AND user is the creator of the decision
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decisions td ON td.id = tda.decision_id
      WHERE tda.file_path = objects.name
        AND td.created_by = auth.uid()
    )
    OR
    -- File belongs to a tenant-wide decision AND user is in the same tenant (visible_to_all)
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decisions td ON td.id = tda.decision_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
      WHERE tda.file_path = objects.name
        AND td.visible_to_all = true
        AND utm.user_id = auth.uid()
        AND utm.is_active = true
    )
    OR
    -- Legacy uploads: file was uploaded under Tenant-ID folder
    -- Any active tenant member can access files in their tenant's decisions
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decisions td ON td.id = tda.decision_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
      WHERE tda.file_path = objects.name
        AND utm.user_id = auth.uid()
        AND utm.is_active = true
    )
  )
);
