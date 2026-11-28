-- P0.2: Fehler im Meldungsteil der Entscheidungs-Trigger dürfen die Fachaktion
-- (Kommentar, Reaktion, Antwort, Teilnehmer-Insert) nicht zurückrollen. Die vier
-- Trigger-Funktionen kapseln deshalb ihre gesamte Arbeit in einen inneren Block:
-- Eine Ausnahme wird als WARNUNG protokolliert, der Trigger liefert NEW zurück und
-- die einfügende Anweisung bleibt bestehen.
--
-- P0.3: Der Selbsttest deckt zusätzlich ein Nicht-Mitglied als Teilnehmer und das
-- Ablaufen der Fünf-Minuten-Sperre ab (Meldung wird künstlich zurückdatiert).

CREATE OR REPLACE FUNCTION public.notify_decision_participant_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_actor text;
BEGIN
  BEGIN
    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = NEW.decision_id;

    IF v_tenant IS NULL OR NEW.user_id = v_creator THEN
      RETURN NEW;
    END IF;

    IF NOT public.is_tenant_member(v_tenant, NEW.user_id) THEN
      RETURN NEW;
    END IF;

    SELECT p.display_name
      INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = v_creator AND p.tenant_id = v_tenant
    LIMIT 1;

    PERFORM public.create_notification(
      NEW.user_id,
      'task_decision_request',
      'Neue Entscheidungsanfrage',
      left(
        coalesce(v_actor, 'Ein Teammitglied')
          || ' bittet um deine Entscheidung: "' || coalesce(v_title, '') || '"',
        240
      ),
      jsonb_build_object(
        'decision_id', NEW.decision_id,
        'decision_title', v_title,
        'tenant_id', v_tenant
      ),
      'medium',
      v_tenant
    );

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_participant_added() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_decision_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_actor text;
  v_recipient uuid;
BEGIN
  BEGIN
    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = NEW.decision_id;

    IF v_tenant IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.display_name
      INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant
    LIMIT 1;

    FOR v_recipient IN
      SELECT DISTINCT candidate.user_id
      FROM (
        SELECT v_creator AS user_id
        UNION
        SELECT p.user_id
        FROM public.task_decision_participants p
        WHERE p.decision_id = NEW.decision_id
      ) AS candidate
      WHERE candidate.user_id IS NOT NULL
        AND candidate.user_id <> NEW.user_id
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN
        CONTINUE;
      END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_comment_received',
        'Neuer Kommentar',
        left(
          coalesce(v_actor, 'Ein Teammitglied')
            || ' hat einen Kommentar zu "' || coalesce(v_title, '') || '" hinterlassen.',
          240
        ),
        jsonb_build_object(
          'decision_id', NEW.decision_id,
          'decision_title', v_title,
          'tenant_id', v_tenant
        ),
        'low',
        v_tenant
      );
    END LOOP;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_comment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_decision_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_decision uuid;
  v_comment_author uuid;
  v_actor text;
  v_recipient uuid;
  -- Kurze Sperrzeit: Entfernen und erneutes Setzen desselben Emojis soll nicht
  -- jedes Mal eine neue Meldung auslösen.
  v_reaction_window constant interval := interval '5 minutes';
BEGIN
  BEGIN
    SELECT c.decision_id, c.user_id
      INTO v_decision, v_comment_author
    FROM public.task_decision_comments c
    WHERE c.id = NEW.comment_id;

    IF v_decision IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = v_decision;

    IF v_tenant IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.display_name
      INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant
    LIMIT 1;

    FOR v_recipient IN
      SELECT DISTINCT candidate.user_id
      FROM (
        SELECT v_comment_author AS user_id
        UNION
        SELECT v_creator AS user_id
        UNION
        SELECT p.user_id
        FROM public.task_decision_participants p
        WHERE p.decision_id = v_decision
      ) AS candidate
      WHERE candidate.user_id IS NOT NULL
        AND candidate.user_id <> NEW.user_id
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.notifications n
        JOIN public.notification_types t ON t.id = n.notification_type_id
        WHERE n.tenant_id = v_tenant
          AND n.user_id = v_recipient
          AND t.tenant_id = v_tenant
          AND t.name = 'task_decision_comment_reaction_received'
          AND n.data->>'comment_id' = NEW.comment_id::text
          AND n.data->>'emoji' = NEW.emoji
          AND n.created_at > now() - v_reaction_window
      ) THEN
        CONTINUE;
      END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_comment_reaction_received',
        'Neue Reaktion',
        left(
          coalesce(v_actor, 'Ein Teammitglied') || ' hat mit ' || NEW.emoji || ' reagiert.',
          240
        ),
        jsonb_build_object(
          'decision_id', v_decision,
          'decision_title', v_title,
          'comment_id', NEW.comment_id,
          'emoji', NEW.emoji,
          'tenant_id', v_tenant
        ),
        'low',
        v_tenant
      );
    END LOOP;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_comment_reaction() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_decision_response_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_participant_user uuid;
  v_participant_name text;
  v_actor text;
  v_total integer;
  v_answered integer;
  v_delivered integer;
  v_comment_changed boolean := false;
  v_creator_response_changed boolean := false;
BEGIN
  BEGIN
    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = NEW.decision_id;

    IF v_tenant IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.user_id INTO v_participant_user
    FROM public.task_decision_participants p
    WHERE p.id = NEW.participant_id;

    IF NEW.comment IS NOT NULL AND btrim(NEW.comment) <> '' THEN
      IF TG_OP = 'INSERT' THEN
        v_comment_changed := true;
      ELSE
        v_comment_changed := OLD.comment IS DISTINCT FROM NEW.comment;
      END IF;
    END IF;

    IF NEW.creator_response IS NOT NULL AND btrim(NEW.creator_response) <> '' THEN
      IF TG_OP = 'INSERT' THEN
        v_creator_response_changed := true;
      ELSE
        v_creator_response_changed := OLD.creator_response IS DISTINCT FROM NEW.creator_response;
      END IF;
    END IF;

    -- Kommentar einer Teilnehmerin oder eines Teilnehmers an den Ersteller.
    IF v_comment_changed
       AND v_participant_user IS NOT NULL
       AND v_participant_user <> v_creator THEN
      SELECT p.display_name INTO v_participant_name
      FROM public.profiles p
      WHERE p.user_id = v_participant_user AND p.tenant_id = v_tenant
      LIMIT 1;

      IF public.is_tenant_member(v_tenant, v_creator) THEN
        PERFORM public.create_notification(
          v_creator,
          'task_decision_comment_received',
          'Neuer Kommentar zu Entscheidungsanfrage',
          left(
            coalesce(v_participant_name, 'Ein Teilnehmer')
              || ' hat einen Kommentar zu "' || coalesce(v_title, '') || '" hinterlassen.',
            240
          ),
          jsonb_build_object(
            'decision_id', NEW.decision_id,
            'decision_title', v_title,
            'tenant_id', v_tenant
          ),
          'medium',
          v_tenant
        );
      END IF;
    END IF;

    -- Antwort des Erstellers auf eine Rückfrage an die Teilnehmerin oder den Teilnehmer.
    IF v_creator_response_changed
       AND v_participant_user IS NOT NULL
       AND v_participant_user <> v_creator
       AND public.is_tenant_member(v_tenant, v_participant_user) THEN
      PERFORM public.create_notification(
        v_participant_user,
        'task_decision_creator_response',
        'Antwort auf Ihren Kommentar',
        left(
          'Der Ersteller hat auf Ihren Kommentar zu "' || coalesce(v_title, '') || '" geantwortet.',
          240
        ),
        jsonb_build_object(
          'decision_id', NEW.decision_id,
          'decision_title', v_title,
          'tenant_id', v_tenant
        ),
        'medium',
        v_tenant
      );
    END IF;

    -- Abschluss: alle Teilnehmenden haben geantwortet. Genau eine Meldung je Entscheidung.
    SELECT count(*) INTO v_total
    FROM public.task_decision_participants p
    WHERE p.decision_id = NEW.decision_id;

    SELECT count(DISTINCT r.participant_id) INTO v_answered
    FROM public.task_decision_responses r
    WHERE r.decision_id = NEW.decision_id;

    IF v_total > 0 AND v_total = v_answered AND public.is_tenant_member(v_tenant, v_creator) THEN
      SELECT count(*) INTO v_delivered
      FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_creator
        AND n.tenant_id = v_tenant
        AND t.name = 'task_decision_completed'
        AND n.data->>'decision_id' = NEW.decision_id::text;

      IF v_delivered = 0 THEN
        PERFORM public.create_notification(
          v_creator,
          'task_decision_completed',
          'Entscheidungsergebnis verfügbar',
          left(
            'Alle Antworten für "' || coalesce(v_title, '') || '" sind eingegangen.',
            240
          ),
          jsonb_build_object(
            'decision_id', NEW.decision_id,
            'decision_title', v_title,
            'tenant_id', v_tenant
          ),
          'medium',
          v_tenant
        );
      END IF;
    END IF;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_response_events() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.decision_notification_selftest(p_tenant uuid)
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
  v_response uuid;
  v_types integer;
  v_request integer;
  v_comment_received integer;
  v_reaction integer;
  v_reaction_after_repeat integer;
  v_reaction_after_expiry integer;
  v_reaction_data boolean := false;
  v_comment_probe uuid;
  v_outsider uuid;
  v_nonmember_notified boolean := false;
  v_nonmember_testable boolean := false;
  v_creator_response integer;
  v_completed integer;
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

  SELECT count(*) INTO v_types
  FROM public.notification_types
  WHERE tenant_id = p_tenant
    AND is_active
    AND name IN (
      'task_decision_request',
      'task_decision_comment_received',
      'task_decision_comment_reaction_received',
      'task_decision_creator_response',
      'task_decision_completed'
    );

  IF v_types < 5 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Nicht alle task_decision_*-Meldungstypen sind im Mandanten aktiv.');
  END IF;

  BEGIN
    INSERT INTO public.task_decisions(title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Entscheidungs-Meldungen', '[SELFTEST]', v_author, p_tenant)
    RETURNING id INTO v_decision;

    -- Eine bewusst abgeschaltete Einstellung darf den Test nicht kippen; die Änderung
    -- fällt mit dem Rollback weg.
    INSERT INTO public.user_notification_settings(user_id, notification_type_id, is_enabled, push_enabled)
    SELECT u.user_id, t.id, true, true
    FROM (VALUES (v_author), (v_recipient)) AS u(user_id)
    CROSS JOIN public.notification_types t
    WHERE t.tenant_id = p_tenant
      AND t.name IN (
        'task_decision_request',
        'task_decision_comment_received',
        'task_decision_comment_reaction_received',
        'task_decision_creator_response',
        'task_decision_completed'
      )
    ON CONFLICT (user_id, notification_type_id) DO UPDATE SET is_enabled = true;

    INSERT INTO public.task_decision_participants(decision_id, user_id)
    VALUES (v_decision, v_recipient)
    RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_comments(decision_id, user_id, content)
    VALUES (v_decision, v_recipient, '[SELFTEST] Kommentar')
    RETURNING id INTO v_comment;

    -- Nicht-Mitglied als Teilnehmer: Anfrage- und Reaktionstrigger dürfen dieser
    -- Person nichts zustellen, obwohl sie in der Kandidatenliste steht.
    SELECT m.user_id INTO v_outsider
    FROM public.user_tenant_memberships m
    WHERE m.is_active
      AND m.user_id <> v_author
      AND NOT EXISTS (
        SELECT 1 FROM public.user_tenant_memberships own
        WHERE own.user_id = m.user_id AND own.tenant_id = p_tenant
      )
    ORDER BY m.user_id
    LIMIT 1;

    IF v_outsider IS NOT NULL THEN
      v_nonmember_testable := true;

      INSERT INTO public.task_decision_comments(decision_id, user_id, content)
      VALUES (v_decision, v_recipient, '[SELFTEST] Kommentar für Nicht-Mitglied')
      RETURNING id INTO v_comment_probe;

      INSERT INTO public.task_decision_participants(decision_id, user_id)
      VALUES (v_decision, v_outsider);

      INSERT INTO public.task_decision_comment_reactions(comment_id, user_id, emoji)
      VALUES (v_comment_probe, v_author, '👍');

      v_nonmember_notified := EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.tenant_id = p_tenant
          AND n.user_id = v_outsider
          AND n.data->>'decision_id' = v_decision::text
      );

      DELETE FROM public.task_decision_participants
      WHERE decision_id = v_decision AND user_id = v_outsider;
    END IF;

    INSERT INTO public.task_decision_comment_reactions(comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    INSERT INTO public.task_decision_responses(decision_id, participant_id, response_type, comment)
    VALUES (v_decision, v_participant, 'yes', '[SELFTEST] Antwortkommentar')
    RETURNING id INTO v_response;

    UPDATE public.task_decision_responses
    SET creator_response = '[SELFTEST] Antwort des Erstellers'
    WHERE id = v_response;

    SELECT
      count(*) FILTER (WHERE t.name = 'task_decision_request'),
      count(*) FILTER (WHERE t.name = 'task_decision_comment_received'),
      count(*) FILTER (WHERE t.name = 'task_decision_comment_reaction_received'),
      count(*) FILTER (WHERE t.name = 'task_decision_creator_response'),
      count(*) FILTER (WHERE t.name = 'task_decision_completed')
      INTO v_request, v_comment_received, v_reaction, v_creator_response, v_completed
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.data->>'decision_id' = v_decision::text;

    -- Ablauf der Sperre: die vorhandene Meldung wird künstlich zurückdatiert, dann
    -- wird erneut reagiert. Danach folgt der Fall innerhalb der Sperre.
    UPDATE public.notifications n
    SET created_at = now() - interval '6 minutes'
    FROM public.notification_types t
    WHERE t.id = n.notification_type_id
      AND t.name = 'task_decision_comment_reaction_received'
      AND n.tenant_id = p_tenant
      AND n.user_id = v_recipient
      AND n.data->>'comment_id' = v_comment::text
      AND n.data->>'emoji' = '👍';

    DELETE FROM public.task_decision_comment_reactions
    WHERE comment_id = v_comment AND user_id = v_author AND emoji = '👍';
    INSERT INTO public.task_decision_comment_reactions(comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    SELECT count(*) INTO v_reaction_after_expiry
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.data->>'decision_id' = v_decision::text
      AND t.name = 'task_decision_comment_reaction_received';

    -- Entfernen und erneutes Setzen desselben Emojis innerhalb der Sperrzeit darf
    -- nicht erneut melden; die Meldung trägt Kommentar und Emoji dafür im data-Feld.
    DELETE FROM public.task_decision_comment_reactions
    WHERE comment_id = v_comment AND user_id = v_author AND emoji = '👍';
    INSERT INTO public.task_decision_comment_reactions(comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    SELECT count(*) INTO v_reaction_after_repeat
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.data->>'decision_id' = v_decision::text
      AND t.name = 'task_decision_comment_reaction_received';

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.tenant_id = p_tenant
        AND n.data->>'comment_id' = v_comment::text
        AND n.data->>'emoji' = '👍'
    ) INTO v_reaction_data;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX024';
  EXCEPTION
    WHEN SQLSTATE 'ZX024' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_request >= 1
      AND v_comment_received >= 1
      AND v_reaction >= 1
      AND v_reaction_after_expiry = v_reaction + 1
      AND v_reaction_after_repeat = v_reaction_after_expiry
      AND v_reaction_data
      AND (NOT v_nonmember_testable OR NOT v_nonmember_notified)
      AND v_creator_response >= 1
      AND v_completed >= 1,
    'delivered', jsonb_build_object(
      'request', v_request,
      'comment_received', v_comment_received,
      'reaction', v_reaction,
      'reaction_after_expiry', v_reaction_after_expiry,
      'reaction_window_expired', v_reaction_after_expiry = v_reaction + 1,
      'reaction_after_repeat', v_reaction_after_repeat,
      'reaction_window_blocked', v_reaction_after_repeat = v_reaction_after_expiry,
      'nonmember_testable', v_nonmember_testable,
      'nonmember_notified', v_nonmember_notified,
      'reaction_data_complete', v_reaction_data,
      'creator_response', v_creator_response,
      'completed', v_completed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_notification_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_notification_selftest(uuid) TO authenticated;
