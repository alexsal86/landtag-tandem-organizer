-- The invoker RPC must retain RLS; its policies call these boolean helpers.
-- Restore authenticated execution without granting anonymous access or bypassing RLS.
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_work_decisions(uuid) TO authenticated;
