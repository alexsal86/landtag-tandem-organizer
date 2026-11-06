CREATE TABLE public.case_item_handover_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  from_user_id uuid,
  to_user_id uuid,
  handed_over_by uuid NOT NULL,
  handed_over_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.case_item_handover_log TO authenticated;
GRANT ALL ON public.case_item_handover_log TO service_role;
ALTER TABLE public.case_item_handover_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read handover log" ON public.case_item_handover_log
  FOR SELECT TO authenticated USING (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())));
CREATE INDEX idx_handover_log_item ON public.case_item_handover_log(case_item_id, handed_over_at DESC);
CREATE INDEX idx_handover_log_tenant ON public.case_item_handover_log(tenant_id, handed_over_at DESC);

CREATE OR REPLACE FUNCTION public.log_case_item_handover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.case_handover', true) = '1'
     AND NEW.next_action_assignee_id IS DISTINCT FROM OLD.next_action_assignee_id THEN
    INSERT INTO public.case_item_handover_log(tenant_id, case_item_id, from_user_id, to_user_id, handed_over_by)
    VALUES (NEW.tenant_id, NEW.id, COALESCE(OLD.next_action_assignee_id, OLD.owner_user_id), NEW.next_action_assignee_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_case_item_handover() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_case_item_handover AFTER UPDATE OF next_action_assignee_id ON public.case_items
FOR EACH ROW EXECUTE FUNCTION public.log_case_item_handover();

-- Runs as the caller, so the normal case_items access rules decide which rows may change.
CREATE OR REPLACE FUNCTION public.handover_case_items(p_item_ids uuid[], p_to_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.case_handover', '1', true);
  UPDATE public.case_items SET next_action_assignee_id = p_to_user_id
   WHERE id = ANY(p_item_ids) AND next_action_assignee_id IS DISTINCT FROM p_to_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.case_handover', '0', true);
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.handover_case_items(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handover_case_items(uuid[], uuid) TO authenticated;