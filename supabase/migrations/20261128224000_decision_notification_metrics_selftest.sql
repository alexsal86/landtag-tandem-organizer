-- Selbsttest der Meldungskennzahlen; alles wird zurückgerollt.
CREATE OR REPLACE FUNCTION public.decision_notification_metrics_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_decision uuid;
  v_before jsonb;
  v_after jsonb;
  v_before_errors integer;
  v_after_errors integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id)
    VALUES ('[SELFTEST] Kennzahlen', '[SELFTEST]', 'open', v_actor, p_tenant)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_actor);

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    SELECT v_decision, p.id, 'yes'
    FROM public.task_decision_participants p
    WHERE p.decision_id = v_decision AND p.user_id = v_actor;

    v_before := public.notification_metrics(p_tenant, 30);
    v_before_errors := coalesce((v_before->'trigger_errors'->>'total')::integer, 0);

    PERFORM public.log_decision_notification_error(
      'selftest', p_tenant, v_decision, '[SELFTEST] erwarteter Trigger-Fehler'
    );

    v_after := public.notification_metrics(p_tenant, 30);
    v_after_errors := coalesce((v_after->'trigger_errors'->>'total')::integer, 0);

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX029';
  EXCEPTION
    WHEN SQLSTATE 'ZX029' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', coalesce((v_after->'deliveries'->>'in_app')::integer, 0) > 0
      AND coalesce((v_after->'first_response'->>'decisions')::integer, 0) >= 1
      AND jsonb_typeof(v_after->'opt_out_by_type') = 'array'
      AND (v_after->'nudges') ? 'rate'
      AND v_after_errors = v_before_errors + 1
      AND (v_after->'trigger_errors'->>'alarm')::boolean,
    'checks', jsonb_build_object(
      'in_app', v_after->'deliveries'->>'in_app',
      'first_response', v_after->'first_response',
      'opt_out_types', jsonb_array_length(coalesce(v_after->'opt_out_by_type', '[]'::jsonb)),
      'trigger_errors_before', v_before_errors,
      'trigger_errors_after', v_after_errors,
      'alarm', v_after->'trigger_errors'->>'alarm'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_notification_metrics_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_notification_metrics_selftest(uuid) TO authenticated;
