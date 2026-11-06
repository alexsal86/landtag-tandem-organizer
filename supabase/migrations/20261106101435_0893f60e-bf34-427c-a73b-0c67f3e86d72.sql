CREATE OR REPLACE FUNCTION public.handover_case_items(p_item_ids uuid[], p_to_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.case_items ci
    WHERE ci.id = ANY(p_item_ids)
      AND NOT public.has_active_tenant_role(auth.uid(), ci.tenant_id, ARRAY['abgeordneter','bueroleitung'])
  ) THEN
    RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung dürfen Vorgänge übergeben' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.case_handover', '1', true);
  UPDATE public.case_items SET next_action_assignee_id = p_to_user_id
   WHERE id = ANY(p_item_ids) AND next_action_assignee_id IS DISTINCT FROM p_to_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.case_handover', '0', true);
  RETURN n;
END $$;