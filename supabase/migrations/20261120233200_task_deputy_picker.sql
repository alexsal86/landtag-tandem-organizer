CREATE FUNCTION public.list_task_deputy_ids(p_tenant_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT membership.user_id
  FROM public.user_tenant_memberships AS membership
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active
    AND membership.role = 'abgeordneter'
    AND public.is_tenant_member(p_tenant_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.list_task_deputy_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_task_deputy_ids(uuid) TO authenticated;
