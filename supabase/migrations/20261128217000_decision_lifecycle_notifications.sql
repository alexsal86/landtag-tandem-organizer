-- P1.6: Fehlende Lebenszyklus-Meldungen für Entscheidungen.
--
-- Bewusst ergänzt:
--   * Frist geändert            -> task_decision_deadline_changed an Teilnehmende
--   * vor der ersten Antwort archiviert (Rückzug) -> task_decision_withdrawn
--   * Ergebnis                  -> task_decision_completed zusätzlich an Teilnehmende
--   * direkte Antwort            -> task_decision_comment_reply nur an den Autor
--   * visible_to_all ohne Teilnehmer -> task_decision_request an alle aktiven Mitglieder
--
-- Bewusst stumm bleiben: Titel-, Beschreibungs-, Prioritäts- und Optionsänderungen,
-- das Archivieren nach eingegangenen Antworten (normaler Abschluss) und jede
-- Änderung durch Nicht-Ersteller ohne Status-/Fristbezug.

-- 1) Drei neue Typen für bestehende und neue Büros.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, v.name, v.label, v.description, 'decisions', true
FROM public.tenants t
CROSS JOIN (VALUES
  ('task_decision_deadline_changed', 'Frist geändert', 'Die Antwortfrist einer Entscheidung wurde geändert.'),
  ('task_decision_withdrawn', 'Entscheidung zurückgezogen', 'Eine Entscheidung wurde vor der ersten Antwort zurückgezogen.'),
  ('task_decision_comment_reply', 'Antwort auf deinen Kommentar', 'Jemand hat direkt auf deinen Kommentar geantwortet.')
) AS v(name, label, description)
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_decision_lifecycle_notification_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES
    (NEW.id, 'task_decision_deadline_changed', 'Frist geändert', 'Die Antwortfrist einer Entscheidung wurde geändert.', 'decisions', true),
    (NEW.id, 'task_decision_withdrawn', 'Entscheidung zurückgezogen', 'Eine Entscheidung wurde vor der ersten Antwort zurückgezogen.', 'decisions', true),
    (NEW.id, 'task_decision_comment_reply', 'Antwort auf deinen Kommentar', 'Jemand hat direkt auf deinen Kommentar geantwortet.', 'decisions', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_decision_lifecycle_notification_types() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seed_decision_lifecycle_notification_types ON public.tenants;
CREATE TRIGGER seed_decision_lifecycle_notification_types
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_decision_lifecycle_notification_types();

-- 2) Teilnehmer-Insert: bei visible_to_all übernimmt die breite Meldung, sonst
--    würde jede Person doppelt benachrichtigt.
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
  v_visible boolean;
  v_actor text;
BEGIN
  BEGIN
    SELECT td.tenant_id, td.title, td.created_by, td.visible_to_all
      INTO v_tenant, v_title, v_creator, v_visible
    FROM public.task_decisions td
    WHERE td.id = NEW.decision_id;

    IF v_tenant IS NULL OR v_visible OR NEW.user_id = v_creator THEN
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

-- 3) Kommentar: direkte Antwort bekommt eine eigene, gezielte Meldung; der
--    Elternautor wird aus der allgemeinen Runde ausgenommen.
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
  v_parent_author uuid;
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

    IF NEW.parent_id IS NOT NULL THEN
      SELECT c.user_id INTO v_parent_author
      FROM public.task_decision_comments c
      WHERE c.id = NEW.parent_id;

      IF v_parent_author IS NOT NULL
         AND v_parent_author <> NEW.user_id
         AND public.is_tenant_member(v_tenant, v_parent_author) THEN
        PERFORM public.create_notification(
          v_parent_author,
          'task_decision_comment_reply',
          'Antwort auf deinen Kommentar',
          left(
            coalesce(v_actor, 'Ein Teammitglied')
              || ' hat auf deinen Kommentar zu "' || coalesce(v_title, '') || '" geantwortet.',
            240
          ),
          jsonb_build_object(
            'decision_id', NEW.decision_id,
            'decision_title', v_title,
            'comment_id', NEW.id,
            'parent_comment_id', NEW.parent_id,
            'tenant_id', v_tenant
          ),
          'medium',
          v_tenant
        );
      END IF;
    END IF;

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
        AND candidate.user_id <> coalesce(v_parent_author, NEW.user_id)
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

-- 4) visible_to_all ohne Teilnehmer: alle aktiven Mitglieder außer dem Ersteller.
CREATE OR REPLACE FUNCTION public.notify_decision_visible_to_all()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor text;
  v_recipient uuid;
BEGIN
  BEGIN
    IF NOT NEW.visible_to_all OR NEW.tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.display_name INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.created_by AND p.tenant_id = NEW.tenant_id
    LIMIT 1;

    FOR v_recipient IN
      SELECT m.user_id
      FROM public.user_tenant_memberships m
      WHERE m.tenant_id = NEW.tenant_id
        AND m.is_active
        AND m.user_id <> NEW.created_by
    LOOP
      PERFORM public.create_notification(
        v_recipient,
        'task_decision_request',
        'Neue Entscheidungsanfrage',
        left(
          coalesce(v_actor, 'Ein Teammitglied')
            || ' hat eine Entscheidung für alle gestellt: "' || coalesce(NEW.title, '') || '"',
          240
        ),
        jsonb_build_object(
          'decision_id', NEW.id,
          'decision_title', NEW.title,
          'tenant_id', NEW.tenant_id,
          'visible_to_all', true
        ),
        'medium',
        NEW.tenant_id
      );
    END LOOP;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_visible_to_all() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_visible_to_all_notification ON public.task_decisions;
CREATE TRIGGER trg_decision_visible_to_all_notification
  AFTER INSERT ON public.task_decisions
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_visible_to_all();

-- 5) Ergebnis zusätzlich an Teilnehmende. Der bestehende Trigger meldet weiterhin
--    den Ersteller; hier werden nur die übrigen Mitglieder je einmal bedient.
CREATE OR REPLACE FUNCTION public.notify_decision_result_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_total integer;
  v_answered integer;
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

    SELECT count(*) INTO v_total
    FROM public.task_decision_participants p
    WHERE p.decision_id = NEW.decision_id;

    SELECT count(DISTINCT r.participant_id) INTO v_answered
    FROM public.task_decision_responses r
    WHERE r.decision_id = NEW.decision_id;

    IF v_total = 0 OR v_total <> v_answered THEN
      RETURN NEW;
    END IF;

    FOR v_recipient IN
      SELECT DISTINCT p.user_id
      FROM public.task_decision_participants p
      WHERE p.decision_id = NEW.decision_id
        AND p.user_id <> v_creator
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.notifications n
        JOIN public.notification_types t ON t.id = n.notification_type_id
        WHERE n.user_id = v_recipient
          AND n.tenant_id = v_tenant
          AND t.name = 'task_decision_completed'
          AND n.data->>'decision_id' = NEW.decision_id::text
      ) THEN
        CONTINUE;
      END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_completed',
        'Entscheidungsergebnis verfügbar',
        left('Alle Antworten für "' || coalesce(v_title, '') || '" sind eingegangen.', 240),
        jsonb_build_object(
          'decision_id', NEW.decision_id,
          'decision_title', v_title,
          'tenant_id', v_tenant
        ),
        'medium',
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
REVOKE ALL ON FUNCTION public.notify_decision_result_participants() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_result_participants_notification ON public.task_decision_responses;
CREATE TRIGGER trg_decision_result_participants_notification
  AFTER INSERT OR UPDATE ON public.task_decision_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_result_participants();

-- 6) Friständerung und früher Rückzug (Archivieren vor der ersten Antwort).
CREATE OR REPLACE FUNCTION public.notify_decision_lifecycle_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor text;
  v_recipient uuid;
  v_has_response boolean;
BEGIN
  BEGIN
    IF NEW.tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.display_name INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id = NEW.tenant_id
    LIMIT 1;

    IF NEW.response_deadline IS DISTINCT FROM OLD.response_deadline
       AND NEW.status IN ('active', 'open') THEN
      FOR v_recipient IN
        SELECT DISTINCT p.user_id
        FROM public.task_decision_participants p
        WHERE p.decision_id = NEW.id
          AND p.user_id <> coalesce(auth.uid(), NEW.created_by)
      LOOP
        IF NOT public.is_tenant_member(NEW.tenant_id, v_recipient) THEN
          CONTINUE;
        END IF;

        PERFORM public.create_notification(
          v_recipient,
          'task_decision_deadline_changed',
          'Antwortfrist geändert',
          left(
            coalesce(v_actor, 'Das Büro') || ' hat die Frist für "' || coalesce(NEW.title, '')
              || '" geändert' || coalesce(': ' || to_char(NEW.response_deadline, 'DD.MM.YYYY'), ' und die Frist entfernt') || '.',
            240
          ),
          jsonb_build_object(
            'decision_id', NEW.id,
            'decision_title', NEW.title,
            'response_deadline', NEW.response_deadline,
            'tenant_id', NEW.tenant_id
          ),
          'medium',
          NEW.tenant_id
        );
      END LOOP;
    END IF;

    IF OLD.status IN ('active', 'open') AND NEW.status = 'archived' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.task_decision_responses r WHERE r.decision_id = NEW.id
      ) INTO v_has_response;

      IF NOT v_has_response THEN
        FOR v_recipient IN
          SELECT DISTINCT p.user_id
          FROM public.task_decision_participants p
          WHERE p.decision_id = NEW.id
            AND p.user_id <> coalesce(auth.uid(), NEW.created_by)
        LOOP
          IF NOT public.is_tenant_member(NEW.tenant_id, v_recipient) THEN
            CONTINUE;
          END IF;

          PERFORM public.create_notification(
            v_recipient,
            'task_decision_withdrawn',
            'Entscheidung zurückgezogen',
            left('Die Entscheidung "' || coalesce(NEW.title, '') || '" wurde vor der ersten Antwort zurückgezogen.', 240),
            jsonb_build_object(
              'decision_id', NEW.id,
              'decision_title', NEW.title,
              'tenant_id', NEW.tenant_id
            ),
            'high',
            NEW.tenant_id
          );
        END LOOP;
      END IF;
    END IF;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_lifecycle_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_decision_lifecycle_notification ON public.task_decisions;
CREATE TRIGGER trg_decision_lifecycle_notification
  AFTER UPDATE ON public.task_decisions
  FOR EACH ROW EXECUTE FUNCTION public.notify_decision_lifecycle_changes();
