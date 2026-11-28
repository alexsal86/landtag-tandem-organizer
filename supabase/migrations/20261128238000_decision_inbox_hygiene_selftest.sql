CREATE OR REPLACE FUNCTION public.decision_inbox_hygiene_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_archive_decision uuid;
  v_old_claims text;
  v_marked integer := 0;
  v_request_read boolean := false;
  v_expired boolean := false;
  v_withdrawn_unread boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Inbox-Hygiene nicht prüfbar.');
  END IF;

  v_old_claims := current_setting('request.jwt.claims', true);

  BEGIN
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Inbox lesen', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    -- Öffnen markiert die Anfrage-Meldung der Person als gelesen.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_recipient, 'role', 'authenticated')::text, true);
    v_marked := public.mark_decision_request_notifications_read(v_decision);
    PERFORM set_config('request.jwt.claims', coalesce(v_old_claims, ''), true);

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_request'
        AND n.data->>'decision_id' = v_decision::text
        AND n.is_read
    ) INTO v_request_read;

    -- Archivieren lässt die offene Anfrage verfallen, erzeugt aber eine
    -- ungelesene Rückzugsmeldung.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Inbox verfallen', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_archive_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_archive_decision, v_recipient);

    UPDATE public.task_decisions SET status = 'archived' WHERE id = v_archive_decision;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_request'
        AND n.data->>'decision_id' = v_archive_decision::text
        AND n.is_read
        AND n.data->>'expired' = 'true'
        AND n.data->>'expired_reason' = 'decision_archived'
    ) INTO v_expired;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_withdrawn'
        AND n.data->>'decision_id' = v_archive_decision::text
        AND NOT n.is_read
    ) INTO v_withdrawn_unread;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX038';
  EXCEPTION
    WHEN SQLSTATE 'ZX038' THEN NULL;
    WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(v_old_claims, ''), true);
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_marked >= 1 AND v_request_read AND v_expired AND v_withdrawn_unread,
    'checks', jsonb_build_object(
      'request_marked_on_open', v_request_read,
      'marked_count', v_marked,
      'request_expired_on_archive', v_expired,
      'withdrawn_stays_unread', v_withdrawn_unread
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_inbox_hygiene_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_inbox_hygiene_selftest(uuid) TO authenticated;
