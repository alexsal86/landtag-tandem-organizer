DO $$ DECLARE r record; BEGIN
FOR r IN SELECT p.oid::regprocedure f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.proname IN ('get_database_size','get_table_size_metrics','get_user_primary_tenant_id') LOOP
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.f);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.f);
END LOOP; END $$;