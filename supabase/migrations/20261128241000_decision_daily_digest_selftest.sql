CREATE OR REPLACE FUNCTION public.decision_daily_digest_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_later_decision uuid;
  v_morning timestamptz := timestamptz '2026-12-01 08:00:00+01';
  v_next_morning timestamptz := timestamptz '2026-12-02 08:00:00+01';
  v_sent integer := 0;
  v_notified boolean := false;
  v_repeat_deliveries integer := 0;
  v_after_disable_notified boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Tagesüberblick nicht prüfbar.');
  END IF;

  BEGIN
    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'digest', daily_digest_enabled = true, updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;
    IF NOT FOUND THEN
      INSERT INTO public.decision_notification_preferences
        (user_id, tenant_id, delivery_mode, daily_digest_enabled)
      VALUES (v_recipient, p_tenant, 'digest', true);
    END IF;

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Tagesüberblick', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    v_sent := public.dispatch_decision_daily_digests(v_morning);
    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_daily_digest'
        AND n.data->>'daily_digest' = 'true'
        AND (n.data->>'decision_count')::integer >= 1
        AND n.data->'decision_ids' @> jsonb_build_array(v_decision::text)
    ) INTO v_notified;

    PERFORM public.dispatch_decision_daily_digests(v_morning);
    SELECT count(*) INTO v_repeat_deliveries
    FROM public.decision_daily_digest_deliveries
    WHERE user_id = v_recipient AND tenant_id = p_tenant AND digest_date = v_morning::date;

    UPDATE public.decision_notification_preferences
    SET daily_digest_enabled = false
    WHERE user_id = v_recipient AND tenant_id = p_tenant;

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Kein Tagesüberblick', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_later_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_later_decision, v_recipient);

    PERFORM public.dispatch_decision_daily_digests(v_next_morning);
    v_after_disable_notified := EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_daily_digest'
        AND n.data->'decision_ids' @> jsonb_build_array(v_later_decision::text)
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX040';
  EXCEPTION
    WHEN SQLSTATE 'ZX040' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_notified AND v_repeat_deliveries = 1 AND NOT v_after_disable_notified,
    'checks', jsonb_build_object(
      'daily_overview_created', v_notified,
      'no_repeat_same_day', v_repeat_deliveries = 1,
      'disabled_sends_nothing', NOT v_after_disable_notified,
      'created_first_run', v_sent
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_daily_digest_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_daily_digest_selftest(uuid) TO authenticated;
