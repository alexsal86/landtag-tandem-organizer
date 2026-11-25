-- Selbsttest: Themen-Meldung kommt genau einmal an – und ohne Primärzuständigkeit gar nicht.
--
-- Die Prüfung muss die Meldung einer *anderen* Person sehen. Unter RLS kann das kein
-- Client, deshalb läuft sie serverseitig (wie knowledge_qa_notification_selftest):
-- echte Writes, echte Trigger, echte Meldung – und am Ende ein RAISE, das die gesamte
-- Teststrecke zurückrollt. Damit bleiben keine Testthemen, Zuständigkeiten, Notizen,
-- Ledger-Zeilen oder Meldungen zurück, auch nicht bei einem Fehlschlag.
--
-- Bewusst SECURITY DEFINER: Themen und Zuständigkeiten werden im Test direkt gesetzt,
-- weil die Rollen-RPCs dafür Leitungsrechte verlangen. Der Rollback macht das folgenlos.

CREATE OR REPLACE FUNCTION public.topic_mention_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_type_id uuid;
  v_topic uuid;
  v_topic_without_primary uuid;
  v_note uuid;
  v_note_without_primary uuid;
  v_delivered integer;
  v_silent integer;
  checks jsonb := '{}';
BEGIN
  IF v_author IS NULL OR NOT public.is_tenant_member(p_tenant, v_author) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501';
  END IF;

  -- Zweite aktive Person im Büro: sie ist die Empfängerin, der Test-Autor schreibt die Notiz.
  SELECT m.user_id
    INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant
    AND m.user_id <> v_author
    AND m.is_active
  ORDER BY m.user_id
  LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Zustellung nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.topics(tenant_id, name, label, icon, color, is_active)
    VALUES (p_tenant, 'selftest-' || substr(gen_random_uuid()::text, 1, 8),
            '[SELFTEST] Thema mit Primärzuständigkeit', 'Tag', '#3b82f6', true)
    RETURNING id INTO v_topic;

    INSERT INTO public.topics(tenant_id, name, label, icon, color, is_active)
    VALUES (p_tenant, 'selftest-' || substr(gen_random_uuid()::text, 1, 8),
            '[SELFTEST] Thema ohne Primärzuständigkeit', 'Tag', '#3b82f6', true)
    RETURNING id INTO v_topic_without_primary;

    INSERT INTO public.employee_responsibilities(tenant_id, user_id, kind, topic_id, level)
    VALUES (p_tenant, v_recipient, 'topic', v_topic, 'primary');

    -- Eine bewusst abgeschaltete Einstellung der Person darf den Test nicht kippen;
    -- die Änderung fällt mit dem Rollback weg.
    SELECT id INTO v_type_id
    FROM public.notification_types
    WHERE tenant_id = p_tenant AND name = 'topic_mention' AND is_active;
    IF v_type_id IS NOT NULL THEN
      INSERT INTO public.user_notification_settings(user_id, notification_type_id, is_enabled, push_enabled)
      VALUES (v_recipient, v_type_id, true, true)
      ON CONFLICT (user_id, notification_type_id) DO UPDATE SET is_enabled = true;
    END IF;

    -- Notiz des angemeldeten Kontos mit Chip: der INSERT-Trigger stellt sofort zu.
    INSERT INTO public.quick_notes(id, tenant_id, user_id, title, content)
    VALUES (gen_random_uuid(), p_tenant, v_author, '[SELFTEST] Thema mit Primärzuständigkeit',
            '<p><span data-lexical-topic-id="' || v_topic || '" data-lexical-topic-label="Primär">#Primär</span></p>')
    RETURNING id INTO v_note;

    SELECT count(*)
      INTO v_delivered
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_recipient
      AND t.name = 'topic_mention'
      AND n.data->>'note_id' = v_note::text;

    checks := jsonb_build_object('delivered_once', v_delivered = 1);

    INSERT INTO public.quick_notes(id, tenant_id, user_id, title, content)
    VALUES (gen_random_uuid(), p_tenant, v_author, '[SELFTEST] Thema ohne Primärzuständigkeit',
            '<p><span data-lexical-topic-id="' || v_topic_without_primary || '" data-lexical-topic-label="Ohne">#Ohne</span></p>')
    RETURNING id INTO v_note_without_primary;

    SELECT count(*)
      INTO v_silent
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND t.name = 'topic_mention'
      AND n.data->>'note_id' = v_note_without_primary::text;

    checks := checks || jsonb_build_object('silent_without_primary', v_silent = 0);

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX021';
  EXCEPTION
    WHEN SQLSTATE 'ZX021' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', NOT EXISTS (SELECT 1 FROM jsonb_each(checks) e WHERE e.value <> 'true'::jsonb),
    'checks', checks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.topic_mention_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topic_mention_selftest(uuid) TO authenticated;
