-- Redaktion: Änderungswunsch muss die verantwortliche Person korrekt adressieren.
--
-- request_social_post_changes (20261124200000) übernahm v_item.responsible_user_id
-- unverändert als Login-ID. Die Spalte trägt laut Board-Auswahl aber die Profil-ID
-- (Fremdschlüssel auf profiles.id), während Aufgabe, task_assignees und
-- create_notification die Login-ID (auth.uid()) erwarten. Bei gesetzter
-- verantwortlicher Person landeten Aufgabe und Meldung deshalb bei einer ID, die
-- kein Konto ist: die betroffene Person erfuhr nichts, und die Aufgabe war niemandem
-- zugeordnet.
--
-- Diese Migration ersetzt die Funktion und löst die ID wie
-- queue_social_content_reapproval auf: erst profiles.id, dann profiles.user_id,
-- zuletzt die anlegende Person. Ausgeschiedene Verantwortliche fallen auf die
-- anlegende Person zurück, damit der Änderungswunsch nicht ins Leere läuft.
-- Verhalten, Fristen, Kommentar, Aufgaben-Weiterverwendung und Rückgabewerte
-- bleiben unverändert.

CREATE OR REPLACE FUNCTION public.request_social_post_changes(
  _item uuid,
  _comment text,
  _due_days integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_item public.social_content_items;
  v_actor uuid;
  v_actor_name text;
  v_topic text;
  v_assignee uuid;
  v_due date;
  v_days integer;
  v_task uuid;
  v_comment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung fehlt' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item FROM public.social_content_items WHERE id = _item FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beitrag nicht gefunden' USING ERRCODE = '22023';
  END IF;

  IF NOT public.user_has_tenant_access(auth.uid(), v_item.tenant_id)
     OR NOT public.has_active_tenant_role(
       auth.uid(), v_item.tenant_id, ARRAY['mitarbeiter', 'praktikant', 'bueroleitung', 'abgeordneter']
     ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Beitrag' USING ERRCODE = '42501';
  END IF;

  IF btrim(coalesce(_comment, '')) = '' THEN
    RAISE EXCEPTION 'Bitte den Änderungswunsch begründen' USING ERRCODE = '22023';
  END IF;

  v_days := greatest(coalesce(_due_days, 3), 1);
  v_due := (now() AT TIME ZONE 'Europe/Berlin')::date + v_days;
  v_actor := (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1);
  v_actor_name := coalesce((SELECT p.display_name FROM public.profiles p WHERE p.id = v_actor), 'Unbekannt');
  SELECT tr.topic INTO v_topic FROM public.topic_backlog tr WHERE tr.id = v_item.topic_backlog_id;

  -- Der Freigabe-Trigger lässt genau diesen Rücksprung über die Funktion zu.
  PERFORM set_config('app.social_approval_workflow', 'on', true);

  UPDATE public.social_content_items
     SET workflow_status = 'draft',
         approval_state = 'rejected',
         approved_at = NULL,
         approved_by = NULL,
         reminder_sent_at = NULL
   WHERE id = v_item.id;

  INSERT INTO public.social_approval_comments(tenant_id, content_item_id, author_id, comment, is_change_request)
  VALUES (v_item.tenant_id, v_item.id, v_actor, btrim(_comment), true)
  RETURNING id INTO v_comment_id;

  -- Verantwortliche Person: Spalte trägt je nach Datenstand Profil- oder Login-ID.
  -- Beide Auslegungen werden auf die Login-ID aufgelöst; ohne (aktive) Zuordnung
  -- gilt die Person, die den Beitrag angelegt hat.
  v_assignee := coalesce(
    (SELECT p.user_id FROM public.profiles p WHERE p.id = v_item.responsible_user_id),
    (SELECT p.user_id FROM public.profiles p WHERE p.user_id = v_item.responsible_user_id)
  );

  IF v_assignee IS NULL
     OR NOT public.is_tenant_member(v_item.tenant_id, v_assignee) THEN
    SELECT p.user_id INTO v_assignee FROM public.profiles p WHERE p.id = v_item.created_by;
  END IF;

  IF v_assignee IS NOT NULL THEN
    -- Offene Aufgabe zum Beitrag weiterverwenden, statt bei jedem Wunsch eine neue anzulegen.
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
         SET assigned_to = v_assignee::text,
             ball_owner = 'office',
             ball_assignee_id = v_assignee,
             status = 'todo',
             priority = 'high',
             next_action = 'Änderungswunsch umsetzen',
             next_action_due = v_due,
             due_date = (v_due + time '09:00') AT TIME ZONE 'Europe/Berlin',
             description = left(btrim(_comment), 2000)
               || E'\n\nBeitrag: /redaktion?highlight=' || v_item.id::text
               || E'\nFrist: ' || to_char(v_due, 'DD.MM.YYYY'),
             timeline = coalesce(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'id', gen_random_uuid()::text,
               'type', 'system',
               'at', now(),
               'actorName', v_actor_name,
               'text', 'Erneuter Änderungswunsch – Ball beim Team, Frist ' || to_char(v_due, 'DD.MM.YYYY')
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
        auth.uid(),
        v_item.tenant_id,
        left('Änderung gewünscht: ' || coalesce(v_topic, 'Social Post'), 240),
        left(btrim(_comment), 2000)
          || E'\n\nBeitrag: /redaktion?highlight=' || v_item.id::text
          || E'\nFrist: ' || to_char(v_due, 'DD.MM.YYYY'),
        v_assignee::text,
        'todo',
        'high',
        'personal',
        (v_due + time '09:00') AT TIME ZONE 'Europe/Berlin',
        'office',
        v_assignee,
        'Änderungswunsch umsetzen',
        v_due,
        'social_content_item',
        v_item.id,
        jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'system',
          'at', now(),
          'actorName', v_actor_name,
          'text', 'Änderung gewünscht – Ball beim Team, Frist ' || to_char(v_due, 'DD.MM.YYYY')
        ))
      );
    END IF;

    INSERT INTO public.task_assignees(task_id, user_id, assigned_by)
    VALUES (v_task, v_assignee, auth.uid())
    ON CONFLICT DO NOTHING;

    PERFORM public.create_notification(
      v_assignee,
      'social_post_change_requested',
      left('Änderung gewünscht: ' || coalesce(v_topic, 'Social Post'), 120),
      left(btrim(_comment), 240),
      jsonb_build_object(
        'content_item_id', v_item.id,
        'task_id', v_task,
        'due_date', v_due,
        'route', '/redaktion?highlight=' || v_item.id::text
      ),
      'high',
      v_item.tenant_id
    );
  END IF;

  RETURN jsonb_build_object(
    'content_item_id', v_item.id,
    'comment_id', v_comment_id,
    'task_id', v_task,
    'due_date', v_due,
    'assignee', v_assignee
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_social_post_changes(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_social_post_changes(uuid, text, integer) TO authenticated;
