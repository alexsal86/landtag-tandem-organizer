CREATE POLICY "Active members can view active memberships in their tenant"
ON public.user_tenant_memberships
FOR SELECT
TO authenticated
USING (
  is_active
  AND public.is_tenant_member(tenant_id, auth.uid())
);