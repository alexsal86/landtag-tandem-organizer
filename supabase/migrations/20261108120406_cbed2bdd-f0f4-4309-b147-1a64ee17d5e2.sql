DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.archive_meeting_with_stafette(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,$old$regexp_split_to_array(regexp_replace(coalesce(t.assigned_to,''),'[{}[:space:]]','','g'),',')::uuid[]$old$,$new$regexp_split_to_array(nullif(regexp_replace(coalesce(t.assigned_to,''),'[{}[:space:]]','','g'),''),',')::uuid[]$new$);
 EXECUTE definition;
END $$;