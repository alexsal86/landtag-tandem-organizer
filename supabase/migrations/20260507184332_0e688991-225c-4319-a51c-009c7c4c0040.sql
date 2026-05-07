
REVOKE ALL ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_data_lint(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_bulk_action_audit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_lint(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
