DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.guard_tenant_references()'::regprocedure) INTO definition;
 definition:=replace(definition,'pa.attname AS parent_col','pa.attname AS parent_col, format_type(pa.atttypid,pa.atttypmod) AS parent_type');
 definition:=replace(definition,$old$format('SELECT tenant_id FROM %I.%I WHERE %I::text=$1 FOR KEY SHARE',ref.parent_schema,ref.parent_table,ref.parent_col)$old$,$new$format('SELECT tenant_id FROM %I.%I WHERE %I=$1::%s FOR KEY SHARE',ref.parent_schema,ref.parent_table,ref.parent_col,ref.parent_type)$new$);
 EXECUTE definition;
END $$;