CREATE SCHEMA IF NOT EXISTS automation_private;
REVOKE ALL ON SCHEMA automation_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA automation_private TO authenticated, service_role;
ALTER FUNCTION public.spawn_annual_task_to_stafette(uuid,integer,uuid) SET SCHEMA automation_private;
CREATE FUNCTION public.spawn_annual_task_to_stafette(_annual_task_id uuid, _year integer, _assignee uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
 SELECT automation_private.spawn_annual_task_to_stafette(_annual_task_id,_year,_assignee);
$$;
REVOKE ALL ON FUNCTION public.spawn_annual_task_to_stafette(uuid,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spawn_annual_task_to_stafette(uuid,integer,uuid) TO authenticated;