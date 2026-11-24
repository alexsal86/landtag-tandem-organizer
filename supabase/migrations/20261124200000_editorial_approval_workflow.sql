-- Redaktioneller Freigabe-Workflow schließen:
--  * „Änderung gewünscht“ setzt den Beitrag zurück auf „In Arbeit“, legt den Ball mit Frist
--    und Aufgabe bei der verantwortlichen Person ab und benachrichtigt sie.
--  * Freigaben werden nach der Bestätigung gesperrt: Wer und wann wird immer aus der Sitzung
--    gesetzt (nicht aus dem Client) und jede Entscheidung landet append-only im Protokoll.

-- 1) Protokoll (append-only, geschrieben nur vom Trigger bzw. den Funktionen unten)
CREATE TABLE IF NOT EXISTS public.social_content_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_user_id uuid,
  actor_name text,
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'reset')),
  from_state text,
  to_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_approval_events_item
  ON public.social_content_approval_events (content_item_id, created_at DESC);

ALTER TABLE public.social_content_approval_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_content_approval_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.social_content_approval_events TO authenticated;
GRANT ALL ON public.social_content_approval_events TO service_role;

CREATE POLICY "social_approval_events_select_scoped"
ON public.social_content_approval_events
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

-- 2) Freigabe-Trigger: Einreichen ist Redaktionsarbeit, Entscheiden ist Leitungssache.
--    Wer/wann kommt ausschließlich aus auth.uid()/now(); Client-Werte werden überschrieben.
CREATE OR REPLACE FUNCTION public.enforce_social_content_approval_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid;
  v_admin boolean;
  v_allowed boolean := false;
  v_workflow_bypass boolean := coalesce(current_setting('app.social_approval_workflow', true), '') = 'on';
BEGIN
  v_actor := (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1);

  IF TG_OP = 'INSERT' THEN
    IF NEW.approval_state = 'approved' AND NOT public.is_tenant_admin(auth.uid(), NEW.tenant_id) THEN
      RAISE EXCEPTION 'Nur Büroleitung und Abgeordnete dürfen Freigaben erteilen.' USING ERRCODE = '42501';
    END IF;
    IF NEW.approval_state = 'approved' THEN
      NEW.approved_at := now();
      NEW.approved_by := v_actor;
    ELSE
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.approval_state, NEW.approved_at, NEW.approved_by)
     IS NOT DISTINCT FROM ROW(OLD.approval_state, OLD.approved_at, OLD.approved_by) THEN
    RETURN NEW;
  END IF;

  v_admin := public.is_tenant_admin(auth.uid(), NEW.tenant_id);

  IF v_workflow_bypass THEN
    v_allowed := true;
  ELSIF NEW.approval_state IN ('approved', 'rejected') OR OLD.approval_state = 'approved' THEN
    -- Bestätigte Freigaben sind gesperrt: nur die Leitung kann sie erteilen oder zurücknehmen.
    v_allowed := v_admin;
  ELSE
    v_allowed := public.has_active_tenant_role(
      auth.uid(), NEW.tenant_id, ARRAY['mitarbeiter', 'praktikant', 'bueroleitung', 'abgeordneter']
    );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Nur Büroleitung und Abgeordnete dürfen Freigaben erteilen oder zurücknehmen.' USING ERRCODE = '42501';
  END IF;

  IF NEW.approval_state = 'approved' THEN
    NEW.approved_at := now();
    NEW.approved_by := v_actor;
  ELSE
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_content_approval_permissions ON public.social_content_items;
CREATE TRIGGER trg_social_content_approval_permissions
  BEFORE UPDATE ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_social_content_approval_permissions();

-- 3) Protokoll schreiben (wer, wann, von welchem Zustand wohin)
CREATE OR REPLACE FUNCTION public.log_social_content_approval_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_from text;
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
    CASE NEW.approval_state
      WHEN 'approved' THEN 'approved'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'pending_approval' THEN 'submitted'
      ELSE 'reset'
    END,
    v_from,
    NEW.approval_state
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_content_approval_log ON public.social_content_items;
CREATE TRIGGER trg_social_content_approval_log
  AFTER INSERT OR UPDATE OF approval_state ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_social_content_approval_event();

-- 4) Änderungswunsch: Beitrag zurück auf „In Arbeit“, Ball mit Frist und Aufgabe beim Verantwortlichen.
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

  -- Ball immer beim Verantwortlichen; ohne Zuweisung bei der Person, die den Beitrag angelegt hat.
  v_assignee := v_item.responsible_user_id;
  IF v_assignee IS NULL THEN
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
