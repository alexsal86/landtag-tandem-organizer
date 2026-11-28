-- Erwähnungen in Vorgangs-Interaktionen werden in der Datenbank zugestellt.
--
-- CaseItemInteractionQuickCapture verschickte die Meldung nach dem Speichern clientseitig
-- über die 6-Argument-Fassung von create_notification. Die löst den Mandanten über
-- get_user_primary_tenant_id() auf; bei mehreren Mitgliedschaften landet die Meldung im
-- falschen Arbeitsbereich oder ist dort unsichtbar. Die 7-Argument-Fassung mit
-- tenant_id_param ist für authenticated gesperrt (REVOKE, kein SECURITY DEFINER).
--
-- Der Trigger liest die Erwähnungen direkt aus dem gespeicherten HTML der Interaktion und
-- stellt über den Mandanten des Vorgangs zu – unabhängig davon, ob Web, Mobile oder ein
-- späterer Import die Interaktion schreibt. Update-Fälle melden nur neu hinzugekommene
-- Erwähnungen, damit das Bearbeiten einer Interaktion nicht erneut benachrichtigt.

-- 1. Meldungstyp für bestehende Büros.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id,
       'case_interaction_mention',
       'In Vorgang erwähnt',
       'Du wurdest in einer Interaktion eines Vorgangs erwähnt.',
       'casefiles',
       true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2. Neue Büros erhalten den Typ sofort.
CREATE OR REPLACE FUNCTION public.seed_case_interaction_mention_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (
    NEW.id,
    'case_interaction_mention',
    'In Vorgang erwähnt',
    'Du wurdest in einer Interaktion eines Vorgangs erwähnt.',
    'casefiles',
    true
  )
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_case_interaction_mention_notification_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_case_interaction_mention_notification_type ON public.tenants;
CREATE TRIGGER seed_case_interaction_mention_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_case_interaction_mention_notification_type();

-- 3. Zustellung an der Interaktion.
CREATE OR REPLACE FUNCTION public.notify_case_interaction_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid := NEW.tenant_id;
  v_subject text;
  v_actor text;
  v_mentioned uuid;
BEGIN
  IF NEW.details IS NULL
     OR position('data-lexical-mention-user-id=' in NEW.details) = 0 THEN
    RETURN NEW;
  END IF;

  -- Mandant gehört zur Interaktion; die Spalte ist nullable, deshalb der Rückfall
  -- auf Vorgang bzw. Fallakte.
  IF v_tenant IS NULL AND NEW.case_item_id IS NOT NULL THEN
    SELECT ci.tenant_id INTO v_tenant
    FROM public.case_items ci
    WHERE ci.id = NEW.case_item_id;
  END IF;
  IF v_tenant IS NULL AND NEW.case_file_id IS NOT NULL THEN
    SELECT cf.tenant_id INTO v_tenant
    FROM public.case_files cf
    WHERE cf.id = NEW.case_file_id;
  END IF;
  IF v_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nullif(btrim(coalesce(ci.subject, '')), '') INTO v_subject
  FROM public.case_items ci
  WHERE ci.id = NEW.case_item_id;

  IF v_subject IS NULL AND NEW.case_file_id IS NOT NULL THEN
    SELECT nullif(btrim(coalesce(cf.title, '')), '') INTO v_subject
    FROM public.case_files cf
    WHERE cf.id = NEW.case_file_id;
  END IF;

  v_subject := coalesce(v_subject, 'Vorgang');

  SELECT p.display_name INTO v_actor
  FROM public.profiles p
  WHERE p.user_id = NEW.created_by AND p.tenant_id = v_tenant
  LIMIT 1;

  FOR v_mentioned IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.details,
      'data-lexical-mention-user-id="([0-9a-fA-F-]{36})"',
      'g'
    ) AS m
  LOOP
    -- Niemand wird über die eigene Erwähnung benachrichtigt.
    IF v_mentioned = NEW.created_by THEN
      CONTINUE;
    END IF;

    -- Beim Bearbeiten nur neue Erwähnungen melden.
    IF TG_OP = 'UPDATE'
       AND position(
         ('data-lexical-mention-user-id="' || v_mentioned::text || '"')
         in coalesce(OLD.details, '')
       ) > 0 THEN
      CONTINUE;
    END IF;

    -- Nur aktive Mitglieder desselben Büros erhalten die Meldung.
    IF NOT public.is_tenant_member(v_tenant, v_mentioned) THEN
      CONTINUE;
    END IF;

    PERFORM public.create_notification(
      v_mentioned,
      'case_interaction_mention',
      'In Vorgang erwähnt',
      left(
        coalesce(v_actor, 'Ein Teammitglied')
          || ' hat dich im Vorgang "' || v_subject || '" erwähnt.',
        240
      ),
      jsonb_build_object(
        'caseItemId', NEW.case_item_id,
        'caseFileId', NEW.case_file_id,
        'interactionId', NEW.id,
        'tenant_id', v_tenant
      ),
      'medium',
      v_tenant
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_case_interaction_mentions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_case_interaction_mention_notification ON public.case_item_interactions;
CREATE TRIGGER trg_case_interaction_mention_notification
  AFTER INSERT OR UPDATE OF details ON public.case_item_interactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_case_interaction_mentions();

-- 4. Selbsttest: echte Interaktion, echter Trigger, echte Meldung – am Ende ein RAISE,
-- das die gesamte Teststrecke zurückrollt. Die Meldung gehört einer anderen Person und
-- ist unter RLS für den Client nicht sichtbar, deshalb läuft die Prüfung serverseitig
-- (gleiches Muster wie quick_note_share_notification_selftest).
CREATE OR REPLACE FUNCTION public.case_interaction_mention_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_type uuid;
  v_case uuid;
  v_interaction uuid;
  v_details text;
  v_delivered integer;
BEGIN
  IF v_author IS NULL OR NOT public.is_tenant_member(p_tenant, v_author) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

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
  WHERE tenant_id = p_tenant AND name = 'case_interaction_mention' AND is_active;

  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Meldungstyp case_interaction_mention fehlt im Mandanten.');
  END IF;

  v_details := '<p>Bitte übernehmen: <span data-lexical-mention-user-id="'
    || v_recipient::text
    || '">@Selbsttest</span></p>';

  BEGIN
    INSERT INTO public.case_items(user_id, tenant_id, subject, summary)
    VALUES (v_author, p_tenant, '[SELFTEST] Erwähnung im Vorgang', '[SELFTEST]')
    RETURNING id INTO v_case;

    -- Eine bewusst abgeschaltete Einstellung der Person darf den Test nicht kippen;
    -- die Änderung fällt mit dem Rollback weg.
    INSERT INTO public.user_notification_settings(user_id, notification_type_id, is_enabled, push_enabled)
    VALUES (v_recipient, v_type, true, true)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE SET is_enabled = true;

    INSERT INTO public.case_item_interactions(
      case_item_id,
      tenant_id,
      interaction_type,
      direction,
      subject,
      details,
      created_by
    )
    VALUES (
      v_case,
      p_tenant,
      'other',
      'internal',
      '[SELFTEST] Erwähnung',
      v_details,
      v_author
    )
    RETURNING id INTO v_interaction;

    -- Genau eine Meldung, und zwar im Mandanten des Vorgangs. Die alte Client-Fassung
    -- hätte den Hauptmandanten der Empfängerin verwendet – hier also nicht.
    SELECT count(*)
      INTO v_delivered
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND t.name = 'case_interaction_mention'
      AND n.data->>'interactionId' = v_interaction::text;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX023';
  EXCEPTION
    WHEN SQLSTATE 'ZX023' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object('ok', v_delivered = 1, 'delivered', v_delivered);
END;
$$;

REVOKE ALL ON FUNCTION public.case_interaction_mention_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_interaction_mention_selftest(uuid) TO authenticated;
