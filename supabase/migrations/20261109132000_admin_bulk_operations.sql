CREATE OR REPLACE FUNCTION public.set_admin_user_colors(_tenant_id uuid,_updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Plattformrechte erforderlich' USING ERRCODE='42501'; END IF;
  IF _updates IS NULL OR jsonb_typeof(_updates)<>'array' OR jsonb_array_length(_updates)>1000 THEN RAISE EXCEPTION 'Ungültige Farbliste'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(_updates) LOOP
    IF NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=_tenant_id AND user_id=(item->>'user_id')::uuid AND is_active) THEN
      RAISE EXCEPTION 'Benutzer gehört nicht zum Büro' USING ERRCODE='42501';
    END IF;
    UPDATE profiles SET badge_color=item->>'badge_color' WHERE user_id=(item->>'user_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profil fehlt'; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.set_admin_user_colors(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_admin_user_colors(uuid,jsonb) TO authenticated;

-- One network request for all office health indicators; no per-row edge invocations.
CREATE OR REPLACE FUNCTION public.get_admin_tenant_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Plattformrechte erforderlich' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_object_agg(t.id,jsonb_build_object(
    'users',(SELECT count(*) FROM user_tenant_memberships WHERE tenant_id=t.id AND is_active),
    'case_file_types',(SELECT count(*) FROM case_file_types WHERE tenant_id=t.id),
    'letter_templates',(SELECT count(*) FROM letter_templates WHERE tenant_id=t.id),
    'meeting_templates',(SELECT count(*) FROM meeting_templates WHERE tenant_id=t.id),
    'notification_types',(SELECT count(*) FROM notification_types WHERE tenant_id=t.id),
    'sender_information',(SELECT count(*) FROM sender_information WHERE tenant_id=t.id),
    'app_settings',(SELECT count(*) FROM app_settings WHERE tenant_id=t.id)
  )),'{}'::jsonb) INTO result FROM tenants t;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_tenant_health() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_tenant_health() TO authenticated;

-- A person's monthly budget is independent in each office.
ALTER TABLE public.expense_budgets DROP CONSTRAINT IF EXISTS expense_budgets_user_id_year_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS expense_budgets_office_month ON public.expense_budgets(user_id,tenant_id,year,month);
