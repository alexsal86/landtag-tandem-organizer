-- Selbsttest: Ergebnis und Kommentare werden für Teilnehmende gebündelt, der Ersteller
-- erhält kein Digest. Alles wird zurückgerollt.
CREATE OR REPLACE FUNCTION public.decision_digest_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_participant uuid;
  v_comment uuid;
  v_digest_count integer;
  v_digest_ok boolean := false;
  v_creator_has_no_digest boolean := true;
  v_old_read boolean := false;
  v_old_superseded boolean := false;
  v_reaction_window_ok boolean := false;
  v_reaction_rows integer;
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
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Digest nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.tenant_notification_settings AS s
      (tenant_id, decision_reaction_window_minutes, decision_digest_minutes, updated_by)
    VALUES (p_tenant, 60, 15, v_author)
    ON CONFLICT (tenant_id) DO UPDATE
      SET decision_reaction_window_minutes = 60,
          decision_digest_minutes = 15,
          updated_by = v_author;

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Digest', '[SELFTEST]', v_author, p_tenant)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient)
    RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_author, '[SELFTEST] Erster Kommentar'),
           (v_decision, v_author, '[SELFTEST] Zweiter Kommentar');

    -- Letzte Antwort: erzeugt die Ergebnismeldung an Teilnehmende und Ersteller.
    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_decision, v_participant, 'yes');

    -- Kommentar- und Ergebnismeldung altern lassen, damit das 15-Minuten-Fenster greift.
    UPDATE public.notifications n
    SET created_at = now() - interval '30 minutes'
    FROM public.notification_types t
    WHERE t.id = n.notification_type_id
      AND n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND t.name IN ('task_decision_comment_received', 'task_decision_completed')
      AND n.data->>'decision_id' = v_decision::text;

    v_digest_count := public.flush_decision_notification_digests();

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_digest'
        AND n.data->>'decision_id' = v_decision::text
        AND (n.data->>'count')::integer = 3
        AND (n.data->>'result_count')::integer = 1
        AND n.data->>'has_result' = 'true'
        AND n.data->>'digest' = 'true'
    ) INTO v_digest_ok;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_author AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_digest'
        AND n.data->>'decision_id' = v_decision::text
    ) INTO v_creator_has_no_digest;

    SELECT bool_and(n.is_read), bool_and(coalesce(n.data->>'superseded', 'false') = 'true')
      INTO v_old_read, v_old_superseded
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_comment_received'
      AND n.data->>'decision_id' = v_decision::text;

    -- Reaktionsfenster 60 Minuten: dasselbe Emoji erneut setzen erzeugt keine zweite Meldung.
    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_recipient, '[SELFTEST] Kommentar für Reaktion')
    RETURNING id INTO v_comment;

    INSERT INTO public.task_decision_comment_reactions (comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    DELETE FROM public.task_decision_comment_reactions
    WHERE comment_id = v_comment AND user_id = v_author AND emoji = '👍';

    INSERT INTO public.task_decision_comment_reactions (comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    SELECT count(*) INTO v_reaction_rows
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_comment_reaction_received'
      AND n.data->>'comment_id' = v_comment::text
      AND n.data->>'emoji' = '👍';

    v_reaction_window_ok := v_reaction_rows = 1;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX028';
  EXCEPTION
    WHEN SQLSTATE 'ZX028' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_digest_ok AND v_creator_has_no_digest AND v_old_read AND v_old_superseded AND v_reaction_window_ok,
    'checks', jsonb_build_object(
      'digest_created', v_digest_ok,
      'creator_has_no_digest', v_creator_has_no_digest,
      'originals_read', v_old_read,
      'originals_superseded', v_old_superseded,
      'reaction_window_from_tenant', v_reaction_window_ok,
      'digests_flushed', v_digest_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_digest_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_digest_selftest(uuid) TO authenticated;
