-- Keep assignee synchronization compatible with PostgreSQL UUIDs and task deletion.
CREATE OR REPLACE FUNCTION public.sync_task_legacy_assigned_to()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_task_id uuid; assignee_values text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN coalesce(NEW, OLD); END IF;
  target_task_id := coalesce(NEW.task_id, OLD.task_id);
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = target_task_id) THEN RETURN coalesce(NEW, OLD); END IF;
  SELECT CASE WHEN count(*) = 0 THEN NULL WHEN count(*) = 1 THEN min(user_id::text)
    ELSE '{' || string_agg(user_id::text, ',' ORDER BY created_at, user_id::text) || '}' END
    INTO assignee_values FROM public.task_assignees WHERE task_id = target_task_id;
  UPDATE public.tasks SET assigned_to = assignee_values
    WHERE id = target_task_id AND assigned_to IS DISTINCT FROM assignee_values;
  RETURN coalesce(NEW, OLD);
END $$;

-- Keep one active task per office step. Task lifecycle events survive task deletion
-- in the existing case interaction journal (source_id deliberately has no task FK).
CREATE UNIQUE INDEX IF NOT EXISTS tasks_one_active_case_step
  ON public.tasks (tenant_id, source_id)
  WHERE source_type = 'case_step' AND status NOT IN ('completed', 'cancelled');

CREATE OR REPLACE FUNCTION public.journal_case_step_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.tasks%ROWTYPE;
  c public.case_items%ROWTYPE;
  event_name text;
  actor_name text;
  assignee_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.source_type = 'case_step'
    AND (NEW.source_type, NEW.source_id, NEW.tenant_id) IS DISTINCT FROM (OLD.source_type, OLD.source_id, OLD.tenant_id) THEN
    RAISE EXCEPTION 'Die Verknüpfung einer Büro-Aufgabe darf nicht entfernt werden';
  END IF;
  IF TG_OP = 'DELETE' THEN t := OLD; ELSE t := NEW; END IF;
  IF t.source_type IS DISTINCT FROM 'case_step' OR t.source_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.case_items WHERE id = t.source_id AND tenant_id = t.tenant_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_case_item(auth.uid(), c.id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf den verknüpften Vorgang' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN event_name := 'Aufgabe erstellt';
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.archived_tasks WHERE task_id = t.id) THEN
      -- Completion normally updates the status and then archives/deletes the row.
      -- The atomic archive RPC can also archive directly without that status update.
      IF t.status = 'completed' THEN RETURN NULL; END IF;
      event_name := 'Aufgabe erledigt';
    ELSE event_name := 'Aufgabe gelöscht'; END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    event_name := CASE WHEN NEW.status = 'completed' THEN 'Aufgabe erledigt'
      WHEN NEW.status = 'cancelled' THEN 'Aufgabe zurückgezogen'
      WHEN OLD.status IN ('completed', 'cancelled') THEN 'Aufgabe wieder geöffnet'
      ELSE 'Aufgabenstatus geändert' END;
  ELSIF (NEW.title, NEW.due_date, NEW.assigned_to) IS DISTINCT FROM (OLD.title, OLD.due_date, OLD.assigned_to) THEN
    event_name := 'Aufgabe aktualisiert';
  ELSE RETURN NULL;
  END IF;

  SELECT display_name INTO actor_name FROM public.profiles WHERE user_id = auth.uid();
  SELECT display_name INTO assignee_name FROM public.profiles WHERE user_id::text = t.assigned_to;
  INSERT INTO public.case_item_interactions (
    case_item_id, tenant_id, interaction_type, direction, subject, summary, details,
    source_type, source_id, created_by, interaction_at, payload
  ) VALUES (
    c.id, c.tenant_id, 'other', 'internal', event_name, event_name,
    concat_ws(' · ', t.title, CASE WHEN t.due_date IS NOT NULL THEN 'Frist: ' || to_char(t.due_date AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY') END),
    'tasks', t.id, auth.uid(), clock_timestamp(),
    jsonb_build_object('origin', 'case_step_task', 'task_status', t.status,
      'task_title', t.title, 'assignee_id', t.assigned_to, 'responsible_name', assignee_name, 'actor_name', actor_name)
  );
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.journal_case_step_task() FROM PUBLIC;
CREATE TRIGGER case_step_task_journal
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.journal_case_step_task();

CREATE OR REPLACE FUNCTION public.sync_case_office_step_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  active_task public.tasks%ROWTYPE;
  assignee uuid;
  is_office boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND
    (NEW.ball_owner, NEW.next_action_label, NEW.next_action_due_at, NEW.next_action_assignee_id, NEW.owner_user_id, NEW.status)
    IS NOT DISTINCT FROM
    (OLD.ball_owner, OLD.next_action_label, OLD.next_action_due_at, OLD.next_action_assignee_id, OLD.owner_user_id, OLD.status)
  THEN RETURN NULL; END IF;

  -- The case row is already locked by its update; this also serializes explicit retries.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.id::text, 0));
  SELECT * INTO active_task FROM public.tasks
    WHERE tenant_id = NEW.tenant_id AND source_type = 'case_step' AND source_id = NEW.id
      AND status NOT IN ('completed', 'cancelled') FOR UPDATE;
  is_office := coalesce(NEW.ball_owner, 'office') = 'office'
    AND NEW.status::text NOT IN ('erledigt', 'archiviert')
    AND nullif(btrim(NEW.next_action_label), '') IS NOT NULL;

  IF NOT is_office THEN
    IF active_task.id IS NOT NULL THEN
      UPDATE public.tasks SET status = CASE
        WHEN NEW.status::text IN ('erledigt', 'archiviert') OR nullif(btrim(NEW.next_action_label), '') IS NULL THEN 'completed'
        ELSE 'cancelled' END,
        progress = CASE WHEN NEW.status::text IN ('erledigt', 'archiviert') OR nullif(btrim(NEW.next_action_label), '') IS NULL THEN 100 ELSE progress END,
        updated_at = clock_timestamp()
      WHERE id = active_task.id;
    END IF;
    RETURN NULL;
  END IF;

  assignee := coalesce(NEW.next_action_assignee_id, NEW.owner_user_id, NEW.user_id);
  IF NOT NEW.tenant_id = ANY(coalesce(public.get_user_tenant_ids(assignee), ARRAY[]::uuid[])) THEN
    RAISE EXCEPTION 'Die zuständige Person gehört nicht zum Büro' USING ERRCODE = '42501';
  END IF;
  -- An explicitly assigned colleague must be able to follow the backlink.
  INSERT INTO public.case_item_participants (case_item_id, user_id, role)
    VALUES (NEW.id, assignee, 'viewer') ON CONFLICT (case_item_id, user_id) DO NOTHING;

  IF active_task.id IS NULL THEN
    INSERT INTO public.tasks (
      tenant_id, user_id, title, description, assigned_to, due_date, priority, category,
      status, progress, source_type, source_id
    ) VALUES (
      NEW.tenant_id, coalesce(auth.uid(), NEW.user_id), btrim(NEW.next_action_label),
      concat_ws(E'\n', 'Vorgang: ' || coalesce(NEW.subject, 'Ohne Betreff'), '/mywork?tab=cases&caseItemId=' || NEW.id::text),
      assignee::text, NEW.next_action_due_at,
      CASE WHEN NEW.priority::text = 'urgent' THEN 'high' ELSE NEW.priority::text END,
      'personal', 'todo', 0, 'case_step', NEW.id
    );
  ELSE
    UPDATE public.tasks SET title = btrim(NEW.next_action_label), due_date = NEW.next_action_due_at,
      assigned_to = assignee::text, updated_at = clock_timestamp()
    WHERE id = active_task.id AND (title, due_date, assigned_to)
      IS DISTINCT FROM (btrim(NEW.next_action_label), NEW.next_action_due_at, assignee::text);
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.sync_case_office_step_task() FROM PUBLIC;
CREATE TRIGGER case_office_step_task
  AFTER INSERT OR UPDATE OF ball_owner, next_action_label, next_action_due_at, next_action_assignee_id, owner_user_id, status
  ON public.case_items FOR EACH ROW EXECUTE FUNCTION public.sync_case_office_step_task();
