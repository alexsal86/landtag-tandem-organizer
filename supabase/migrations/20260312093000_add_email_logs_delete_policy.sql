-- Allow users to delete their own email logs within their tenant.
CREATE POLICY "Users can delete their own email logs"
  ON public.email_logs FOR DELETE
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    AND user_id = auth.uid()
  );
