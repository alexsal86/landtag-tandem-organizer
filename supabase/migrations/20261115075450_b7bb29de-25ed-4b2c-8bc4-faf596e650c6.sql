DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.guard_tenant_references()'::regprocedure) INTO definition;
 definition:=replace(definition,'IF FOUND AND parent_tenant IS DISTINCT FROM target_tenant THEN','IF parent_tenant IS DISTINCT FROM target_tenant THEN');
 EXECUTE definition;
END $$;