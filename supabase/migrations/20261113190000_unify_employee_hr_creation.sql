-- Employee administration owns employment creation; HR displays and processes its packages.
CREATE OR REPLACE FUNCTION public.save_employee_lifecycle(p_tenant uuid,p_user uuid,p_type text,p_start date,p_end date DEFAULT NULL,p_mentor uuid DEFAULT NULL,p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; template_id uuid; direction_name text;
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Nur die Büroleitung oder Abgeordnete dürfen Beschäftigungen ändern.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user)
 OR (p_mentor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_mentor AND is_active)) THEN RAISE EXCEPTION 'Person oder Mentor gehört nicht zum Büro.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO employee_lifecycle(tenant_id,user_id,employment_type,start_date,end_date,mentor_user_id) VALUES(p_tenant,p_user,btrim(p_type),p_start,p_end,p_mentor)
  ON CONFLICT(tenant_id,user_id,start_date) DO UPDATE SET employment_type=excluded.employment_type,end_date=excluded.end_date,mentor_user_id=excluded.mentor_user_id RETURNING id INTO result;
 ELSE
  UPDATE employee_lifecycle SET employment_type=btrim(p_type),start_date=p_start,end_date=p_end,mentor_user_id=p_mentor WHERE id=p_id AND tenant_id=p_tenant AND user_id=p_user RETURNING id INTO result;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Beschäftigung nicht gefunden.' USING ERRCODE='42501'; END IF;
 -- Keep the employee overview and HR attached to the same employment data.
 INSERT INTO employee_settings(user_id,admin_id,employment_start_date)
 VALUES(p_user,auth.uid(),p_start)
 ON CONFLICT(user_id) DO UPDATE SET employment_start_date=excluded.employment_start_date;
 PERFORM automation_private.seed_employee_hr_templates(p_tenant);
 FOREACH direction_name IN ARRAY ARRAY['onboarding','offboarding'] LOOP
  IF direction_name='offboarding' AND p_end IS NULL THEN CONTINUE; END IF;
  -- Running packages keep their original anchors and template snapshot.
  IF EXISTS(SELECT 1 FROM routine_package_runs WHERE employee_lifecycle_id=result AND hr_direction=direction_name) THEN CONTINUE; END IF;
  SELECT id INTO template_id FROM employee_hr_templates
   WHERE tenant_id=p_tenant AND direction=direction_name AND employment_type IN (btrim(p_type),'all')
   ORDER BY (employment_type=btrim(p_type)) DESC LIMIT 1;
  IF template_id IS NULL THEN RAISE EXCEPTION 'Keine passende HR-Vorlage für % (%).',p_type,direction_name USING ERRCODE='22023'; END IF;
  PERFORM start_employee_hr(result,template_id);
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_employee_lifecycle(uuid,uuid,text,date,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_employee_lifecycle(uuid,uuid,text,date,date,uuid,uuid) TO authenticated;
