DO $$ DECLARE r record; BEGIN
FOR r IN SELECT p.oid::regprocedure f, p.prorettype='trigger'::regtype trg FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')
 AND p.proname IN ('field_read_rule','field_row_visible','mask_secured_record','quick_note_access','quick_note_member','quick_note_owned') OR (n.nspname='public' AND p.prosecdef AND p.prorettype='trigger'::regtype AND has_function_privilege('anon',p.oid,'EXECUTE'))
LOOP
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.f);
 IF NOT r.trg THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.f); END IF;
END LOOP; END $$;