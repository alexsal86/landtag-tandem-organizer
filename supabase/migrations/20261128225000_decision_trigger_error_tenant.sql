-- Trigger auf task_decision_responses kennen keinen Mandanten; die Zuordnung läuft
-- über die Entscheidung. Ohne sie würden diese Ausnahmen in keiner Mandantenquote
-- auftauchen.
CREATE OR REPLACE FUNCTION public.log_decision_notification_error(
  _source text,
  _tenant_id uuid,
  _decision_id uuid,
  _message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_recipient uuid;
  v_tenant uuid := _tenant_id;
BEGIN
  IF v_tenant IS NULL AND _decision_id IS NOT NULL THEN
    SELECT td.tenant_id INTO v_tenant FROM public.task_decisions td WHERE td.id = _decision_id;
  END IF;

  INSERT INTO public.decision_notification_trigger_errors (source, tenant_id, decision_id, message)
  VALUES (left(coalesce(_source, 'unbekannt'), 120), v_tenant, _decision_id, left(coalesce(_message, 'unbekannt'), 500));

  BEGIN
    IF v_tenant IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.tenant_id = v_tenant
        AND t.name = 'task_decision_trigger_alert'
        AND n.created_at > now() - interval '1 hour'
    ) THEN
      FOR v_recipient IN
        SELECT m.user_id FROM public.user_tenant_memberships m
        WHERE m.tenant_id = v_tenant AND m.is_active AND m.role = 'bueroleitung'
      LOOP
        PERFORM public.create_notification(
          v_recipient,
          'task_decision_trigger_alert',
          'Meldungsfehler protokolliert',
          'Ein Entscheidungs-Trigger konnte eine Meldung nicht zustellen; die Änderung blieb erhalten.',
          jsonb_build_object('tenant_id', v_tenant, 'decision_id', _decision_id, 'source', _source, 'alarm', true),
          'high',
          v_tenant
        );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_decision_notification_error(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
