-- Phase 5. Restrictive policy intersects ALL older permissive policies,
-- including tenant-admin ALL. Sensitive JSON is never readable by other admins.
DROP POLICY IF EXISTS employee_sensitive_read_scope ON public.employee_meetings;
CREATE POLICY employee_sensitive_read_scope ON public.employee_meetings AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id,auth.uid()) AND (employee_id=auth.uid() OR EXISTS
  (SELECT 1 FROM public.employee_settings es WHERE es.user_id=employee_id AND es.admin_id=auth.uid())));

CREATE OR REPLACE FUNCTION public.get_employee_meeting_trend(p_employee_id uuid,p_tenant_id uuid)
RETURNS TABLE(id uuid,meeting_date timestamptz,status text,mood integer,workload integer,balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(p_tenant_id,auth.uid()) OR
     NOT (auth.uid()=p_employee_id OR EXISTS(SELECT 1 FROM public.employee_settings es WHERE es.user_id=p_employee_id AND es.admin_id=auth.uid())) THEN
    RAISE EXCEPTION 'Der Verlauf ist nur für die betroffene Person und die direkte Führungskraft sichtbar' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT m.id,m.meeting_date,m.status,
    CASE WHEN m.protocol_data->>'wellbeing_mood_rating' ~ '^[1-5]$' THEN (m.protocol_data->>'wellbeing_mood_rating')::integer END,
    CASE WHEN m.protocol_data->>'wellbeing_workload_rating' ~ '^[1-5]$' THEN (m.protocol_data->>'wellbeing_workload_rating')::integer END,
    CASE WHEN m.protocol_data->>'wellbeing_balance_rating' ~ '^[1-5]$' THEN (m.protocol_data->>'wellbeing_balance_rating')::integer END
  FROM public.employee_meetings m WHERE m.tenant_id=p_tenant_id AND m.employee_id=p_employee_id AND m.status IN ('completed','acknowledged')
  ORDER BY m.meeting_date DESC,m.id DESC LIMIT 12;
END $$;
REVOKE ALL ON FUNCTION public.get_employee_meeting_trend(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_employee_meeting_trend(uuid,uuid) TO authenticated;
