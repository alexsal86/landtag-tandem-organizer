-- Entscheidungs-Meldungen entstehen in der Datenbank und damit im Mandanten der Entscheidung.
--
-- Die Entscheidungsoberfläche verschickte task_decision_* clientseitig über die
-- 6-Argument-Fassung von create_notification. Die löst den Mandanten über
-- get_user_primary_tenant_id() auf; bei mehreren Mitgliedschaften landet die Meldung
-- im falschen Arbeitsbereich oder ist dort unsichtbar. Die 7-Argument-Fassung ist für
-- authenticated gesperrt.
--
-- Deshalb entstehen Anfrage-, Kommentar-, Reaktions-, Ersteller-Antwort- und
-- Abschluss-Meldungen direkt an den Datensätzen. Alle Trigger lesen den Mandanten aus
-- task_decisions und prüfen die aktive Mitgliedschaft der Empfängerin bzw. des
-- Empfängers. Das gilt damit auch für Antworten über die öffentliche Antwortseite und
-- für Einträge, die nicht aus dieser Oberfläche stammen.

-- 1. Einladung: neue Teilnehmerin oder neuer Teilnehmer.
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
END;
$$;

REVOKE ALL ON FUNCTION public.notify_decision_participant_added() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_participant_notification ON public.task_decision_participants;
CREATE TRIGGER trg_decision_participant_notification
  AFTER INSERT ON public.task_decision_participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_participant_added();

-- 2. Kommentar an der Entscheidung.
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
END;
$$;

REVOKE ALL ON FUNCTION public.notify_decision_comment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_comment_notification ON public.task_decision_comments;
CREATE TRIGGER trg_decision_comment_notification
  AFTER INSERT ON public.task_decision_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_comment();

-- 3. Emoji-Reaktion auf einen Kommentar.
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
END;
$$;

REVOKE ALL ON FUNCTION public.notify_decision_comment_reaction() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_comment_reaction_notification ON public.task_decision_comment_reactions;
CREATE TRIGGER trg_decision_comment_reaction_notification
  AFTER INSERT ON public.task_decision_comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_comment_reaction();

-- 4. Antworten: Kommentar am Antwortdatensatz, Ersteller-Antwort und Abschluss.
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
END;
$$;

REVOKE ALL ON FUNCTION public.notify_decision_response_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_response_notification ON public.task_decision_responses;
CREATE TRIGGER trg_decision_response_notification
  AFTER INSERT OR UPDATE ON public.task_decision_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_response_events();

-- 5. Die serverseitige Abschluss-/Archivfunktion nutzt denselben Mandanten statt der
--    Hauptmitgliedschaft der Empfängerin.
CREATE OR REPLACE FUNCTION public.check_and_archive_decision(p_decision_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  total_participants integer;
  total_responses integer;
  open_questions integer;
  decision_status text;
  decision_title text;
  decision_creator uuid;
  decision_tenant uuid;
BEGIN
  SELECT status, title, created_by, tenant_id
    INTO decision_status, decision_title, decision_creator, decision_tenant
  FROM public.task_decisions
  WHERE id = p_decision_id;

  IF decision_status IS NULL OR decision_status NOT IN ('active', 'open') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO total_participants
  FROM public.task_decision_participants
  WHERE decision_id = p_decision_id;

  SELECT count(DISTINCT participant_id) INTO total_responses
  FROM public.task_decision_responses
  WHERE decision_id = p_decision_id;

  SELECT count(*) INTO open_questions
  FROM (
    SELECT DISTINCT ON (participant_id) participant_id, response_type, creator_response
    FROM public.task_decision_responses
    WHERE decision_id = p_decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses
  WHERE response_type = 'question' AND creator_response IS NULL;

  IF total_participants > 0
     AND total_participants = total_responses
     AND open_questions = 0 THEN
    UPDATE public.task_decisions
    SET status = 'archived', archived_at = now(), archived_by = decision_creator
    WHERE id = p_decision_id AND status IN ('active', 'open');

    IF decision_tenant IS NOT NULL THEN
      PERFORM public.create_notification(
        decision_creator,
        'task_decision_completed',
        'Entscheidung automatisch archiviert',
        left(
          'Die Entscheidung "' || coalesce(decision_title, '')
            || '" wurde automatisch archiviert.',
          240
        ),
        jsonb_build_object('decision_id', p_decision_id, 'tenant_id', decision_tenant),
        'low',
        decision_tenant
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_archive_decision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_archive_decision(uuid) TO authenticated;

-- 6. Selbsttest: echte Entscheidung, echter Trigger, echte Meldungen – am Ende ein
--    RAISE, das die gesamte Teststrecke zurückrollt. Die Meldungen gehören teilweise
--    anderen Personen und sind unter RLS für den Client nicht sichtbar, deshalb läuft
--    die Prüfung serverseitig.
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
  v_reaction_data boolean := false;
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
      AND v_reaction_after_repeat = v_reaction
      AND v_reaction_data
      AND v_creator_response >= 1
      AND v_completed >= 1,
    'delivered', jsonb_build_object(
      'request', v_request,
      'comment_received', v_comment_received,
      'reaction', v_reaction,
      'reaction_after_repeat', v_reaction_after_repeat,
      'reaction_window_blocked', v_reaction_after_repeat = v_reaction,
      'reaction_data_complete', v_reaction_data,
      'creator_response', v_creator_response,
      'completed', v_completed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_notification_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_notification_selftest(uuid) TO authenticated;
