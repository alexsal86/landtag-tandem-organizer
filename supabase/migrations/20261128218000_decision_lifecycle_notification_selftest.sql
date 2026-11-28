-- Selbsttest für die Lebenszyklus-Meldungen. Prüft je Fall Typ, Empfänger und
-- Auslöser und rollt alles zurück.
CREATE OR REPLACE FUNCTION public.decision_lifecycle_notification_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_visible_decision uuid;
  v_withdrawn_decision uuid;
  v_parent_comment uuid;
  v_participant uuid;
  v_visible_request boolean := false;
  v_deadline_changed boolean := false;
  v_reply_targeted boolean := false;
  v_reply_generic_absent boolean := false;
  v_result_recipient boolean := false;
  v_result_creator boolean := false;
  v_withdrawn boolean := false;
  v_deadline timestamptz := now() + interval '2 days';
BEGIN
  IF v_author IS NULL OR NOT public.is_tenant_member(p_tenant, v_author) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_author AND m.is_active
  ORDER BY m.user_id
  LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Zustellung nicht prüfbar.');
  END IF;

  -- Einstellungen für die neuen Typen bewusst aktivieren; fällt mit dem Rollback weg.
  INSERT INTO public.user_notification_settings (user_id, notification_type_id, is_enabled, push_enabled)
  SELECT v_recipient, t.id, true, false
  FROM public.notification_types t
  WHERE t.tenant_id = p_tenant
    AND t.name IN ('task_decision_request', 'task_decision_deadline_changed', 'task_decision_comment_reply',
                   'task_decision_completed', 'task_decision_withdrawn')
  ON CONFLICT (user_id, notification_type_id) DO UPDATE SET is_enabled = true;

  BEGIN
    -- visible_to_all ohne Teilnehmer -> Anfrage an alle aktiven Mitglieder.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, visible_to_all, response_deadline)
    VALUES ('[SELFTEST] Lebenszyklus', '[SELFTEST]', v_author, p_tenant, true, v_deadline)
    RETURNING id INTO v_visible_decision;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND t.name = 'task_decision_request'
        AND n.data->>'decision_id' = v_visible_decision::text
        AND n.data->>'visible_to_all' = 'true'
    ) INTO v_visible_request;

    -- Friständerung -> Teilnehmende.
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_visible_decision, v_recipient) RETURNING id INTO v_participant;

    UPDATE public.task_decisions
    SET response_deadline = v_deadline + interval '2 days'
    WHERE id = v_visible_decision;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND t.name = 'task_decision_deadline_changed'
        AND n.data->>'decision_id' = v_visible_decision::text
    ) INTO v_deadline_changed;

    -- Direkte Antwort -> nur Elternautor, keine generische Kommentarmeldung.
    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_visible_decision, v_recipient, '[SELFTEST] Frage')
    RETURNING id INTO v_parent_comment;

    INSERT INTO public.task_decision_comments (decision_id, user_id, parent_id, content)
    VALUES (v_visible_decision, v_author, v_parent_comment, '[SELFTEST] Antwort');

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND t.name = 'task_decision_comment_reply'
        AND n.data->>'decision_id' = v_visible_decision::text
    ) INTO v_reply_targeted;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND t.name = 'task_decision_comment_received'
        AND n.data->>'decision_id' = v_visible_decision::text
    ) INTO v_reply_generic_absent;

    -- Ergebnis -> Ersteller und Teilnehmende.
    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_visible_decision, v_participant, 'yes');

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND t.name = 'task_decision_completed'
        AND n.data->>'decision_id' = v_visible_decision::text
    ) INTO v_result_recipient;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_author AND t.name = 'task_decision_completed'
        AND n.data->>'decision_id' = v_visible_decision::text
    ) INTO v_result_creator;

    -- Rückzug vor der ersten Antwort -> Teilnehmende.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, visible_to_all)
    VALUES ('[SELFTEST] Rückzug', '[SELFTEST]', v_author, p_tenant, false)
    RETURNING id INTO v_withdrawn_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_withdrawn_decision, v_recipient);

    UPDATE public.task_decisions SET status = 'archived' WHERE id = v_withdrawn_decision;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND t.name = 'task_decision_withdrawn'
        AND n.data->>'decision_id' = v_withdrawn_decision::text
    ) INTO v_withdrawn;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX027';
  EXCEPTION
    WHEN SQLSTATE 'ZX027' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_visible_request AND v_deadline_changed AND v_reply_targeted AND v_reply_generic_absent
      AND v_result_recipient AND v_result_creator AND v_withdrawn,
    'checks', jsonb_build_object(
      'visible_to_all_request', v_visible_request,
      'deadline_changed', v_deadline_changed,
      'reply_targeted', v_reply_targeted,
      'reply_generic_absent', v_reply_generic_absent,
      'result_recipient', v_result_recipient,
      'result_creator', v_result_creator,
      'withdrawn', v_withdrawn
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_lifecycle_notification_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_lifecycle_notification_selftest(uuid) TO authenticated;
