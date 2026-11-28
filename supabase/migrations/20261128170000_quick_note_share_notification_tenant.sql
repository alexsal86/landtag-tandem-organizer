-- Freigabe-Meldungen entstehen in der Datenbank und damit im Mandanten der Notiz.
--
-- notifyQuickNoteShared rief create_notification in der 6-Argument-Fassung auf. Die löst
-- den Mandanten über get_user_primary_tenant_id() auf – bei mehreren Mitgliedschaften
-- landet die Meldung im falschen Arbeitsbereich oder ist dort unsichtbar. Die
-- 7-Argument-Fassung mit tenant_id_param ist für authenticated gesperrt (REVOKE, kein
-- SECURITY DEFINER); ein Client-Aufruf damit würde scheitern.
--
-- Deshalb entsteht die Meldung – wie bei Thema-Erwähnungen – direkt an der Freigabe:
-- Der Trigger stellt über die SECURITY-DEFINER-Funktion im Mandanten der Notiz zu.
-- Er gilt damit für Web, Mobile und offline nachgereichte Freigaben gleichermaßen.

CREATE OR REPLACE FUNCTION public.notify_quick_note_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_title text;
  v_actor text;
BEGIN
  -- Eine Freigabe an sich selbst ist keine Meldung wert.
  IF NEW.shared_with_user_id = NEW.shared_by_user_id THEN
    RETURN NEW;
  END IF;

  -- enforce_quick_note_scope (BEFORE INSERT) hat NEW.tenant_id bereits aus der Notiz
  -- gesetzt und einen fehlenden Mandanten abgelehnt; hier wird nur noch der Titel gebraucht.
  SELECT btrim(regexp_replace(coalesce(n.title, ''), '<[^>]*>', ' ', 'g'))
    INTO v_title
  FROM public.quick_notes n
  WHERE n.id = NEW.note_id;

  SELECT p.display_name
    INTO v_actor
  FROM public.profiles p
  WHERE p.user_id = NEW.shared_by_user_id AND p.tenant_id = NEW.tenant_id
  LIMIT 1;

  PERFORM public.create_notification(
    NEW.shared_with_user_id,
    'quick_note_shared',
    'Notiz geteilt',
    left(
      coalesce(v_actor, 'Ein Teammitglied')
        || ' hat die Notiz "' || coalesce(nullif(v_title, ''), 'Ohne Titel') || '" mit dir geteilt.',
      240
    ),
    jsonb_build_object('noteId', NEW.note_id, 'tenant_id', NEW.tenant_id),
    'medium',
    NEW.tenant_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_quick_note_share() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_quick_note_share_notification ON public.quick_note_shares;
CREATE TRIGGER trg_quick_note_share_notification
  AFTER INSERT ON public.quick_note_shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_quick_note_share();

-- Selbsttest: echte Freigabe, echter Trigger, echte Meldung – und am Ende ein RAISE,
-- das die gesamte Teststrecke zurückrollt. Die Meldung gehört einer anderen Person und
-- ist unter RLS für den Client nicht sichtbar, deshalb läuft die Prüfung serverseitig
-- (gleiches Muster wie topic_mention_selftest).
CREATE OR REPLACE FUNCTION public.quick_note_share_notification_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_type uuid;
  v_note uuid;
  v_delivered integer;
BEGIN
  IF v_author IS NULL OR NOT public.is_tenant_member(p_tenant, v_author) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  -- Empfängerin ist eine zweite aktive Person; ohne sie ist die Zustellung nicht prüfbar.
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

  SELECT id
    INTO v_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'quick_note_shared' AND is_active;

  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Meldungstyp quick_note_shared fehlt im Mandanten.');
  END IF;

  BEGIN
    INSERT INTO public.quick_notes(id, tenant_id, user_id, title, content)
    VALUES (gen_random_uuid(), p_tenant, v_author, '[SELFTEST] Freigabe-Meldung', '<p>[SELFTEST] Freigabe</p>')
    RETURNING id INTO v_note;

    -- Eine bewusst abgeschaltete Einstellung der Person darf den Test nicht kippen;
    -- die Änderung fällt mit dem Rollback weg.
    INSERT INTO public.user_notification_settings(user_id, notification_type_id, is_enabled, push_enabled)
    VALUES (v_recipient, v_type, true, true)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE SET is_enabled = true;

    INSERT INTO public.quick_note_shares(tenant_id, note_id, shared_with_user_id, shared_by_user_id, permission_type)
    VALUES (p_tenant, v_note, v_recipient, v_author, 'view');

    -- Genau eine Meldung, und zwar in diesem Mandanten. Bei der alten 6-Argument-Fassung
    -- stünde sie im Hauptmandanten der Empfängerin – hier also nicht.
    SELECT count(*)
      INTO v_delivered
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND t.name = 'quick_note_shared'
      AND n.data->>'noteId' = v_note::text;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX022';
  EXCEPTION
    WHEN SQLSTATE 'ZX022' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object('ok', v_delivered = 1, 'delivered', v_delivered);
END;
$$;

REVOKE ALL ON FUNCTION public.quick_note_share_notification_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_note_share_notification_selftest(uuid) TO authenticated;
