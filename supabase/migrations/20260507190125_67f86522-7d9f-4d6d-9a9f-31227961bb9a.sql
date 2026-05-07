
REVOKE ALL ON FUNCTION public.audit_rls_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_rls_gaps() TO authenticated;

REVOKE ALL ON FUNCTION public.snapshot_rls_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_rls_coverage() TO authenticated;
