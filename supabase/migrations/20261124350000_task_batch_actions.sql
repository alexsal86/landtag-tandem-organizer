-- Sammelaktionen der Aufgaben-Stafette: Vorschau, verbindliche Ausführung und Rücknahme.
--
-- Regeln (eine Quelle für Vorschau und Ausführung, public.task_batch_plan):
--   * "week"  verschiebt ausschließlich vorhandene Fristen und erfindet nie eine Frist.
--   * "deputy" setzt nur dann einen nächsten Schritt, wenn noch keiner vorhanden ist.
--   * "nudge" folgt den Grenzen von public.nudge_task (nicht extern, nicht selbst, 24 Stunden).
-- Jede Ausführung schreibt ihre Vorher-/Nachher-Werte in task_batch_actions,
-- damit die Rücknahme exakt ist und fremde Änderungen nicht überschreibt.

CREATE TABLE IF NOT EXISTS public.task_batch_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('deputy', 'week', 'nudge')),
  affected_count integer NOT NULL CHECK (affected_count > 0),
  skipped_count integer NOT NULL DEFAULT 0,
  undo_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid
);

CREATE INDEX IF NOT EXISTS task_batch_actions_tenant_idx
  ON public.task_batch_actions (tenant_id, created_at DESC);

ALTER TABLE public.task_batch_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_batch_actions_select ON public.task_batch_actions;
CREATE POLICY task_batch_actions_select ON public.task_batch_actions
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.is_tenant_admin(auth.uid(), tenant_id));

GRANT SELECT ON public.task_batch_actions TO authenticated;

-- Restorable snapshot of one task. Both the write and the undo use this exact
-- shape, so the undo guard compares like with like.
CREATE OR REPLACE FUNCTION public.task_stafette_batch_snapshot(_task public.tasks)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'ball_owner', _task.ball_owner,
    'ball_assignee_id', _task.ball_assignee_id,
    'ball_external_label', _task.ball_external_label,
    'ball_handed_at', _task.ball_handed_at,
    'ball_handed_by', _task.ball_handed_by,
    'ball_accepted_at', _task.ball_accepted_at,
    'stafette_resume_on', _task.stafette_resume_on,
    'next_action', _task.next_action,
    'next_action_due', _task.next_action_due,
    'reminder_at', _task.reminder_at,
    'reminder_note', _task.reminder_note,
    'reminder_notified_at', _task.reminder_notified_at,
    'nudged_at', _task.nudged_at,
    'nudged_by', _task.nudged_by,
    'nudge_note', _task.nudge_note,
    'nudge_count', _task.nudge_count,
    'nudge_seen_at', _task.nudge_seen_at,
    'timeline', _task.timeline
  );
$$;

REVOKE ALL ON FUNCTION public.task_stafette_batch_snapshot(public.tasks) FROM PUBLIC, anon, authenticated;

-- One rule set for preview and execution: which task is touched, which is skipped and why.
CREATE OR REPLACE FUNCTION public.task_batch_plan(_tenant_id uuid, _task_ids uuid[], _action text)
RETURNS TABLE (task_id uuid, title text, eligible boolean, reason text, before_text text, after_text text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  deputy uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_tenant_member(_tenant_id, me) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;
  IF _action IS NULL OR _action NOT IN ('deputy', 'week', 'nudge') THEN
    RAISE EXCEPTION 'Unbekannte Sammelaktion' USING ERRCODE = '22023';
  END IF;
  IF _task_ids IS NULL OR cardinality(_task_ids) = 0 THEN
    RAISE EXCEPTION 'Keine Aufgaben ausgewählt' USING ERRCODE = '22023';
  END IF;
  IF cardinality(_task_ids) > 200 THEN
    RAISE EXCEPTION 'Höchstens 200 Aufgaben pro Sammelaktion' USING ERRCODE = '22023';
  END IF;

  SELECT deputy_id.user_id INTO deputy
  FROM public.list_task_deputy_ids(_tenant_id) AS deputy_id(user_id)
  ORDER BY deputy_id.user_id
  LIMIT 1;

  RETURN QUERY
  WITH picked AS (SELECT DISTINCT ids.id FROM unnest(_task_ids) AS ids(id))
  SELECT
    picked.id,
    CASE WHEN task.id IS NULL OR task.tenant_id <> _tenant_id THEN NULL ELSE task.title END,
    CASE
      WHEN task.id IS NULL THEN false
      WHEN task.tenant_id <> _tenant_id THEN false
      WHEN task.status = 'completed' THEN false
      WHEN _action = 'week' AND task.next_action_due IS NULL THEN false
      WHEN _action = 'deputy' AND deputy IS NULL THEN false
      WHEN _action = 'deputy' AND task.ball_owner = 'deputy' THEN false
      WHEN _action = 'nudge' AND task.ball_owner = 'external' THEN false
      WHEN _action = 'nudge' AND (task.ball_assignee_id = me OR (task.ball_owner = 'office' AND task.ball_assignee_id IS NULL)) THEN false
      WHEN _action = 'nudge' AND task.nudged_by = me AND task.nudged_at > now() - interval '24 hours' THEN false
      ELSE true
    END,
    CASE
      WHEN task.id IS NULL THEN 'Aufgabe nicht gefunden'
      WHEN task.tenant_id <> _tenant_id THEN 'anderes Büro'
      WHEN task.status = 'completed' THEN 'bereits erledigt'
      WHEN _action = 'week' AND task.next_action_due IS NULL THEN 'keine Frist gesetzt'
      WHEN _action = 'deputy' AND deputy IS NULL THEN 'kein Abgeordnetenprofil im Büro'
      WHEN _action = 'deputy' AND task.ball_owner = 'deputy' THEN 'schon bei Abgeordnete/r'
      WHEN _action = 'nudge' AND task.ball_owner = 'external' THEN 'extern – nicht anstupsbar'
      WHEN _action = 'nudge' AND (task.ball_assignee_id = me OR (task.ball_owner = 'office' AND task.ball_assignee_id IS NULL)) THEN 'du bist selbst am Zug'
      WHEN _action = 'nudge' AND task.nudged_by = me AND task.nudged_at > now() - interval '24 hours' THEN 'heute schon angestupst'
      ELSE NULL
    END,
    CASE _action
      WHEN 'week' THEN to_char(task.next_action_due, 'DD.MM.YYYY')
      WHEN 'deputy' THEN NULLIF(btrim(task.next_action), '')
      ELSE NULL
    END,
    CASE _action
      WHEN 'week' THEN to_char(task.next_action_due + 7, 'DD.MM.YYYY')
      WHEN 'deputy' THEN COALESCE(NULLIF(btrim(task.next_action), ''), 'Freigabe prüfen')
      ELSE NULL
    END
  FROM picked
  LEFT JOIN public.tasks AS task ON task.id = picked.id
  ORDER BY picked.id;
END
$$;

REVOKE ALL ON FUNCTION public.task_batch_plan(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;

-- Read-only preview: "x Aufgaben, y werden übersprungen" plus the planned change per task.
CREATE OR REPLACE FUNCTION public.batch_task_stafette_preview(_tenant_id uuid, _task_ids uuid[], _action text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH plan AS (
    SELECT * FROM public.task_batch_plan(_tenant_id, _task_ids, _action)
  )
  SELECT jsonb_build_object(
    'action', _action,
    'total', (SELECT count(*) FROM plan),
    'affected', (SELECT count(*) FROM plan WHERE plan.eligible),
    'skipped', (SELECT count(*) FROM plan WHERE NOT plan.eligible),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'task_id', plan.task_id,
        'title', plan.title,
        'eligible', plan.eligible,
        'reason', plan.reason,
        'before', plan.before_text,
        'after', plan.after_text
      ) ORDER BY plan.task_id)
      FROM plan
    ), '[]'::jsonb)
  );
$$;

-- Execute exactly the previewed rules in one transaction and store the undo payload.
CREATE OR REPLACE FUNCTION public.batch_task_stafette_action(_tenant_id uuid, _task_ids uuid[], _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  item record;
  task_row public.tasks;
  before_row jsonb;
  after_row jsonb;
  changes jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  deputy uuid;
  affected integer := 0;
  batch_id uuid := gen_random_uuid();
  new_due date;
  actor_name text;
BEGIN
  SELECT display_name INTO actor_name FROM public.profiles WHERE user_id = me LIMIT 1;

  FOR item IN SELECT * FROM public.task_batch_plan(_tenant_id, _task_ids, _action) LOOP
    IF NOT item.eligible THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object(
        'task_id', item.task_id, 'title', item.title, 'reason', item.reason
      ));
      CONTINUE;
    END IF;

    SELECT * INTO task_row FROM public.tasks WHERE id = item.task_id FOR UPDATE;
    IF NOT FOUND THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object(
        'task_id', item.task_id, 'title', item.title, 'reason', 'Aufgabe nicht gefunden'
      ));
      CONTINUE;
    END IF;
    before_row := public.task_stafette_batch_snapshot(task_row);

    IF _action = 'week' THEN
      new_due := task_row.next_action_due + 7;
      UPDATE public.tasks
      SET next_action_due = new_due,
          timeline = COALESCE(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'id', gen_random_uuid()::text,
            'type', 'system',
            'at', now(),
            'actorName', actor_name,
            'text', 'Frist um eine Woche verschoben: '
              || to_char(task_row.next_action_due, 'DD.MM.YYYY') || ' → ' || to_char(new_due, 'DD.MM.YYYY')
          ))
      WHERE id = task_row.id;
    ELSIF _action = 'deputy' THEN
      SELECT deputy_id.user_id INTO deputy
      FROM public.list_task_deputy_ids(_tenant_id) AS deputy_id(user_id)
      ORDER BY deputy_id.user_id
      LIMIT 1;
      -- Ein vorhandener nächster Schritt bleibt unangetastet; nur ein leerer Schritt wird gefüllt.
      UPDATE public.tasks
      SET ball_owner = 'deputy',
          ball_assignee_id = deputy,
          next_action = COALESCE(NULLIF(btrim(next_action), ''), 'Freigabe prüfen')
      WHERE id = task_row.id;
    ELSE
      PERFORM public.nudge_task(task_row.id, NULL);
    END IF;

    SELECT * INTO task_row FROM public.tasks WHERE id = task_row.id;
    after_row := public.task_stafette_batch_snapshot(task_row);
    changes := changes || jsonb_build_array(jsonb_build_object(
      'task_id', task_row.id, 'before', before_row, 'after', after_row
    ));
    affected := affected + 1;
  END LOOP;

  IF affected = 0 THEN
    batch_id := NULL;
  ELSE
    INSERT INTO public.task_batch_actions (id, tenant_id, actor_id, action, affected_count, skipped_count, undo_payload)
    VALUES (batch_id, _tenant_id, me, _action, affected, jsonb_array_length(skipped),
            jsonb_build_object('version', 1, 'changes', changes));
  END IF;

  RETURN jsonb_build_object(
    'batch_id', batch_id,
    'action', _action,
    'affected', affected,
    'skipped', jsonb_array_length(skipped),
    'items', changes,
    'skipped_items', skipped
  );
END
$$;

-- Undo restores the exact previous values and refuses when a task changed since.
CREATE OR REPLACE FUNCTION public.undo_task_batch_action(_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  batch public.task_batch_actions;
  change jsonb;
  task_row public.tasks;
  current_row jsonb;
  before_row jsonb;
  restored integer := 0;
BEGIN
  SELECT * INTO batch FROM public.task_batch_actions WHERE id = _batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sammelaktion nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NULL OR NOT (
    batch.actor_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), batch.tenant_id)
    OR public.is_superadmin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Sammelaktion' USING ERRCODE = '42501';
  END IF;
  IF batch.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'Diese Sammelaktion wurde bereits zurückgenommen' USING ERRCODE = '22023';
  END IF;
  IF batch.undo_payload->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(batch.undo_payload->'changes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Für diese Sammelaktion ist keine Rücknahme verfügbar' USING ERRCODE = '22023';
  END IF;

  -- The handover trigger must not invent a new handover while values are restored.
  PERFORM set_config('app.task_batch_undo', batch.id::text, true);

  FOR change IN SELECT value FROM jsonb_array_elements(batch.undo_payload->'changes') LOOP
    SELECT * INTO task_row FROM public.tasks WHERE id = (change->>'task_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Eine Aufgabe der Sammelaktion existiert nicht mehr. Rücknahme nicht ausgeführt.'
        USING ERRCODE = '22023';
    END IF;
    current_row := public.task_stafette_batch_snapshot(task_row);
    IF current_row IS DISTINCT FROM change->'after' THEN
      RAISE EXCEPTION '„%“ wurde inzwischen geändert. Rücknahme nicht ausgeführt.', task_row.title
        USING ERRCODE = '22023';
    END IF;
    before_row := change->'before';
    UPDATE public.tasks
    SET ball_owner = before_row->>'ball_owner',
        ball_assignee_id = (before_row->>'ball_assignee_id')::uuid,
        ball_external_label = before_row->>'ball_external_label',
        ball_handed_at = (before_row->>'ball_handed_at')::timestamptz,
        ball_handed_by = (before_row->>'ball_handed_by')::uuid,
        ball_accepted_at = (before_row->>'ball_accepted_at')::timestamptz,
        stafette_resume_on = (before_row->>'stafette_resume_on')::date,
        next_action = before_row->>'next_action',
        next_action_due = (before_row->>'next_action_due')::date,
        reminder_at = (before_row->>'reminder_at')::timestamptz,
        reminder_note = before_row->>'reminder_note',
        reminder_notified_at = (before_row->>'reminder_notified_at')::timestamptz,
        nudged_at = (before_row->>'nudged_at')::timestamptz,
        nudged_by = (before_row->>'nudged_by')::uuid,
        nudge_note = before_row->>'nudge_note',
        nudge_count = COALESCE((before_row->>'nudge_count')::integer, 0),
        nudge_seen_at = (before_row->>'nudge_seen_at')::timestamptz,
        timeline = CASE
          WHEN before_row->'timeline' IS NULL OR before_row->'timeline' = 'null'::jsonb THEN '[]'::jsonb
          ELSE before_row->'timeline'
        END
    WHERE id = task_row.id;
    restored := restored + 1;
  END LOOP;

  PERFORM set_config('app.task_batch_undo', '', true);
  UPDATE public.task_batch_actions SET undone_at = now(), undone_by = auth.uid() WHERE id = batch.id;
  RETURN restored;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.task_batch_undo', '', true);
  RAISE;
END
$$;

REVOKE ALL ON FUNCTION public.batch_task_stafette_preview(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batch_task_stafette_action(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_task_batch_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_task_stafette_preview(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_task_stafette_action(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_task_batch_action(uuid) TO authenticated;

-- Same handover rule as before, with one exception: a batch undo restores values
-- that the trigger would otherwise overwrite with a new handover.
CREATE OR REPLACE FUNCTION public.record_task_stafette_handover() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  actor uuid := auth.uid();
  event_text text;
BEGIN
  IF COALESCE(current_setting('app.task_batch_undo', true), '') <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.ball_owner = 'deputy' AND NEW.ball_assignee_id IS NULL
    AND (NEW.ball_owner IS DISTINCT FROM OLD.ball_owner OR OLD.ball_assignee_id IS NOT NULL) THEN
    SELECT deputy.id INTO NEW.ball_assignee_id
    FROM public.list_task_deputy_ids(NEW.tenant_id) AS deputy(id)
    ORDER BY deputy.id LIMIT 1;
  END IF;

  IF ROW(NEW.ball_owner, NEW.ball_assignee_id, NEW.ball_external_label)
    IS DISTINCT FROM ROW(OLD.ball_owner, OLD.ball_assignee_id, OLD.ball_external_label) THEN
    IF actor IS NOT NULL AND NEW.ball_assignee_id IS NOT NULL
      AND NOT public.is_tenant_member(NEW.tenant_id, NEW.ball_assignee_id) THEN
      RAISE EXCEPTION 'Die empfangende Person gehört nicht zu diesem Büro';
    END IF;
    NEW.ball_handed_by := actor;
    NEW.ball_handed_at := now();
    NEW.ball_accepted_at := NULL;
    NEW.stafette_resume_on := NULL;
    NEW.nudge_seen_at := CASE WHEN OLD.nudged_at IS NOT NULL THEN now() END;
    IF NEW.ball_owner <> 'external' AND NEW.reminder_at IS NOT DISTINCT FROM OLD.reminder_at THEN
      NEW.reminder_at := NULL;
      NEW.reminder_note := NULL;
    END IF;
    event_text := CASE NEW.ball_owner
      WHEN 'external' THEN 'Wartet auf ' || COALESCE(NEW.ball_external_label, 'externe Rückmeldung')
      WHEN 'deputy' THEN 'An Abgeordnete/n übergeben'
      ELSE 'Ans Büro übergeben'
    END;
  ELSIF NEW.ball_accepted_at IS DISTINCT FROM OLD.ball_accepted_at THEN
    IF actor IS NULL OR actor IS DISTINCT FROM OLD.ball_assignee_id OR OLD.ball_owner = 'external'
       OR OLD.ball_handed_at IS NULL OR OLD.ball_accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Diese Übergabe kann nur die empfangende Person übernehmen';
    END IF;
    NEW.ball_accepted_at := now();
    event_text := 'Übergabe übernommen';
  ELSE
    NEW.ball_handed_at := OLD.ball_handed_at;
    NEW.ball_handed_by := OLD.ball_handed_by;
  END IF;

  IF event_text IS NOT NULL THEN
    NEW.timeline := COALESCE(NEW.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'type', 'system', 'at', now(), 'text', event_text,
      'actorId', actor, 'recipientId', NEW.ball_assignee_id, 'nextAction', NEW.next_action
    ));
  END IF;
  IF NEW.reminder_at IS DISTINCT FROM OLD.reminder_at THEN
    NEW.reminder_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
