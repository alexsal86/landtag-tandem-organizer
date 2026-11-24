-- Redaktion: Wird eine bestätigte Freigabe durch eine inhaltliche Änderung aufgehoben, muss das
-- ankommen. 20261124260000 setzt den Beitrag zurück in die Freigabe (pending_approval) und
-- protokolliert den Vorgang als 'reopened' – bisher ohne Benachrichtigung und ohne Aufgabe.
--
-- Diese Migration hängt beides an genau dieses Protokollereignis. Dadurch wird jeder Rücksprung
-- genau einmal gemeldet, egal ob er über die Beitragsfelder oder über die Kanaltexte in
-- social_content_variants ausgelöst wurde (dort läuft derselbe UPDATE durch dieselben Trigger).
--
-- Empfänger ist die verantwortliche Person. Ist keine hinterlegt, geht die Meldung an alle
-- aktiven Büroleitungen und Abgeordneten; in diesem Fall entsteht keine Aufgabe, weil es keinen
-- einzelnen Verantwortlichen gibt, dem sie ohne Doppelung zugewiesen werden könnte.
-- Eine offene Aufgabe zum Beitrag wird weiterverwendet (wie bei request_social_post_changes),
-- damit wiederholte Änderungen keine Aufgabenlawine erzeugen.

-- 1) Eigener Benachrichtigungstyp je Mandant – create_notification ohne passenden Typ => NULL.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id,
       'social_post_approval_reopened',
       'Social Post – Freigabe erneut nötig',
       'Der Inhalt eines freigegebenen Beitrags wurde geändert; die Freigabe muss erneut erteilt werden.',
       'editorial',
       true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Neue Mandanten erhalten den Typ sofort, damit die Meldung nicht stillschweigend entfällt.
CREATE OR REPLACE FUNCTION public.seed_social_reopen_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id,
          'social_post_approval_reopened',
          'Social Post – Freigabe erneut nötig',
          'Der Inhalt eines freigegebenen Beitrags wurde geändert; die Freigabe muss erneut erteilt werden.',
          'editorial',
          true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_social_reopen_notification_type ON public.tenants;
CREATE TRIGGER seed_social_reopen_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_social_reopen_notification_type();

REVOKE ALL ON FUNCTION public.seed_social_reopen_notification_type() FROM PUBLIC, anon, authenticated;

-- 2) Benachrichtigung und Aufgabe zum Rücksprung.
--    Die Funktion ist SECURITY DEFINER, weil sie als Folge einer normalen Beitragsänderung läuft
--    und die Redaktion selbst keine Aufgaben für andere anlegen oder Benachrichtigungen
--    verschicken darf.
CREATE OR REPLACE FUNCTION public.queue_social_content_reapproval(_item_id uuid, _event_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.social_content_items;
  v_topic text;
  v_actor uuid;
  v_actor_name text;
  v_actor_user uuid;
  v_recipient uuid;
  v_due date;
  v_task uuid;
  v_task_title text;
  v_task_description text;
BEGIN
  SELECT * INTO v_item FROM public.social_content_items WHERE id = _item_id;
  IF NOT FOUND OR v_item.approval_state <> 'pending_approval' THEN
    RETURN;
  END IF;

  v_topic := (SELECT tr.topic FROM public.topic_backlog tr WHERE tr.id = v_item.topic_backlog_id);
  v_actor := (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1);
  v_actor_name := coalesce((SELECT p.display_name FROM public.profiles p WHERE p.id = v_actor), 'Unbekannt');
  v_actor_user := coalesce(auth.uid(), v_item.responsible_user_id);

  -- Frist wie beim Änderungswunsch (request_social_post_changes: drei Tage).
  v_due := (now() AT TIME ZONE 'Europe/Berlin')::date + 3;
  v_task_title := left('Freigabe erneut nötig: ' || coalesce(v_topic, 'Social Post'), 240);
  v_task_description := 'Der Inhalt eines freigegebenen Beitrags wurde geändert. Die Freigabe gilt '
    || 'deshalb nicht mehr und muss erneut erteilt werden.'
    || E'\n\nBeitrag: /redaktion?highlight=' || v_item.id::text
    || E'\nFrist: ' || to_char(v_due, 'DD.MM.YYYY');

  -- responsible_user_id trägt laut Board-Auswahl die Login-ID, laut Fremdschlüssel die Profil-ID.
  -- Beide Auslegungen werden aufgelöst, damit die Meldung in jedem Datenstand ankommt.
  v_recipient := coalesce(
    (SELECT p.user_id FROM public.profiles p WHERE p.id = v_item.responsible_user_id),
    (SELECT p.user_id FROM public.profiles p WHERE p.user_id = v_item.responsible_user_id)
  );

  -- Ausgeschiedene Verantwortliche bekommen weder Aufgabe noch Meldung; dann gilt der Fallback.
  IF v_recipient IS NOT NULL
     AND NOT public.is_tenant_member(v_item.tenant_id, v_recipient) THEN
    v_recipient := NULL;
  END IF;

  IF v_recipient IS NOT NULL THEN
    PERFORM public.create_notification(
      v_recipient,
      'social_post_approval_reopened',
      v_task_title,
      v_task_description,
      jsonb_build_object(
        'content_item_id', v_item.id, 'event_id', _event_id, 'reason', 'content_changed', 'due_date', v_due
      ),
      'high',
      v_item.tenant_id
    );

    -- Offene Aufgabe zum Beitrag weiterverwenden, statt bei jeder Änderung eine neue anzulegen.
    SELECT t.id INTO v_task
      FROM public.tasks t
     WHERE t.tenant_id = v_item.tenant_id
       AND t.source_type = 'social_content_item'
       AND t.source_id = v_item.id
       AND t.status <> 'completed'
     ORDER BY t.created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF v_task IS NOT NULL THEN
      UPDATE public.tasks
         SET assigned_to = v_recipient::text,
             ball_owner = 'office',
             ball_assignee_id = v_recipient,
             status = 'todo',
             priority = 'high',
             next_action = 'Freigabe erneut einholen',
             next_action_due = v_due,
             due_date = (v_due + time '09:00') AT TIME ZONE 'Europe/Berlin',
             description = v_task_description,
             timeline = coalesce(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'id', gen_random_uuid()::text,
               'type', 'system',
               'at', now(),
               'actorName', v_actor_name,
               'text', 'Freigabe durch inhaltliche Änderung zurückgesetzt – erneut nötig, Frist '
                 || to_char(v_due, 'DD.MM.YYYY')
             )),
             updated_at = now()
       WHERE id = v_task;
    ELSE
      v_task := gen_random_uuid();

      INSERT INTO public.tasks(
        id, user_id, tenant_id, title, description, assigned_to, status, priority, category,
        due_date, ball_owner, ball_assignee_id, next_action, next_action_due, source_type, source_id, timeline
      ) VALUES (
        v_task,
        v_actor_user,
        v_item.tenant_id,
        v_task_title,
        v_task_description,
        v_recipient::text,
        'todo',
        'high',
        'personal',
        (v_due + time '09:00') AT TIME ZONE 'Europe/Berlin',
        'office',
        v_recipient,
        'Freigabe erneut einholen',
        v_due,
        'social_content_item',
        v_item.id,
        jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'system',
          'at', now(),
          'actorName', v_actor_name,
          'text', 'Freigabe durch inhaltliche Änderung zurückgesetzt – erneut nötig, Frist '
            || to_char(v_due, 'DD.MM.YYYY')
        ))
      );
    END IF;

    INSERT INTO public.task_assignees(task_id, user_id, assigned_by)
    VALUES (v_task, v_recipient, v_actor_user)
    ON CONFLICT DO NOTHING;

    RETURN;
  END IF;

  -- Kein Verantwortlicher: Die Freigabe liegt bei Büroleitung und Abgeordneten.
  FOR v_recipient IN
    SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_tenant_memberships m ON m.user_id = p.user_id
     WHERE m.tenant_id = v_item.tenant_id
       AND m.is_active
       AND m.role = ANY (ARRAY['bueroleitung', 'abgeordneter'])
     ORDER BY p.display_name, p.user_id
  LOOP
    PERFORM public.create_notification(
      v_recipient,
      'social_post_approval_reopened',
      v_task_title,
      'Der Inhalt wurde geändert; die Freigabe ist wieder offen. Beitrag: /redaktion?highlight='
        || v_item.id::text,
      jsonb_build_object(
        'content_item_id', v_item.id, 'event_id', _event_id, 'reason', 'content_changed', 'due_date', v_due
      ),
      'high',
      v_item.tenant_id
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_social_content_reapproval(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3) Protokollfunktion aus 20261124260000 übernehmen und den Rücksprung melden.
--    Die Meldung hängt am Protokolleintrag, damit sie genau einmal pro Rücksprung entsteht.
CREATE OR REPLACE FUNCTION public.log_social_content_approval_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_from text;
  v_action text;
  v_event_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.approval_state NOT IN ('pending_approval', 'approved') THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.approval_state IS NOT DISTINCT FROM OLD.approval_state THEN
      RETURN NEW;
    END IF;
    v_from := OLD.approval_state;
  END IF;

  v_action := CASE
    WHEN NEW.approval_state = 'approved' THEN 'approved'
    WHEN NEW.approval_state = 'rejected' THEN 'rejected'
    WHEN NEW.approval_state = 'pending_approval' AND v_from = 'approved' THEN 'reopened'
    WHEN NEW.approval_state = 'pending_approval' THEN 'submitted'
    ELSE 'reset'
  END;

  v_actor := (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1);
  v_actor_name := coalesce((SELECT p.display_name FROM public.profiles p WHERE p.id = v_actor), 'Unbekannt');

  INSERT INTO public.social_content_approval_events(
    tenant_id, content_item_id, actor_id, actor_user_id, actor_name, action, from_state, to_state
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    v_actor,
    auth.uid(),
    v_actor_name,
    v_action,
    v_from,
    NEW.approval_state
  )
  RETURNING id INTO v_event_id;

  IF v_action = 'reopened' THEN
    -- Die Ereignis-ID macht jede Meldung eindeutig; sonst würde create_notification
    -- einen zweiten Rücksprung innerhalb einer Minute als Dublette verwerfen.
    PERFORM public.queue_social_content_reapproval(NEW.id, v_event_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_content_approval_log ON public.social_content_items;
CREATE TRIGGER trg_social_content_approval_log
  AFTER INSERT OR UPDATE ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_social_content_approval_event();
