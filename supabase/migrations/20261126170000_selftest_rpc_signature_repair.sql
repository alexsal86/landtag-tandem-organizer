-- Selbsttest-RPCs: PGRST202 „Could not find the function … in the schema cache“.
--
-- Meldung aus dem Selbsttest-Center:
--   * Notizen-Lifecycle, „Aus Notiz eine Aufgabe machen (verknüpft)“:
--     public.create_note_work(p_kind, p_note_id)
--   * Aufgaben-Stafette, „Sammelaktion: Aufgabe ohne Frist wird übersprungen“:
--     public.batch_task_stafette_preview(_action, _task_ids, _tenant_id)
--
-- PGRST202 heißt: PostgREST findet keine Funktion, deren Name UND deren
-- Argumentnamen zu dem Aufruf passen. Die Client-Aufrufe und die generierten
-- Typen (src/integrations/supabase/types.ts) nennen genau die Parameter aus den
-- Migrationen 20261107150000 und 20261124360000 – der Aufruf ist also richtig.
-- Fehlt die Funktion auf der Instanz oder trägt sie eine ältere Signatur (andere
-- Parameternamen, z. B. aus einer früheren Fassung), läuft der Aufruf nie an;
-- „CREATE OR REPLACE FUNCTION“ mit anderen Parameternamen ist in PostgreSQL
-- nicht möglich (42P13), deshalb werden die Einstiegspunkte vorher über ihre
-- Typsignatur verworfen und neu angelegt.
--
-- Die Definitionen sind unverändert aus 20261107150000 (create_note_work) und
-- 20261124360000 (Sammelaktionen) übernommen, damit Verhalten und Regeln nicht
-- auseinanderlaufen. Die Migration ist wiederholbar: Tabellen entstehen nur bei
-- Bedarf, Funktionen werden ersetzt, Rechte neu gesetzt, und am Ende wird der
-- Schema-Cache von PostgREST neu geladen.

DROP FUNCTION IF EXISTS public.create_note_work(uuid, text);

CREATE FUNCTION public.create_note_work(p_note_id uuid, p_kind text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n public.quick_notes%ROWTYPE; result uuid; headline text; prio text;
BEGIN
 SELECT * INTO n FROM quick_notes WHERE id=p_note_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kein Zugriff auf die Notiz' USING ERRCODE='42501'; END IF;
 headline := coalesce(nullif(regexp_replace(n.title,'<[^>]*>','','g'),''),left(regexp_replace(n.content,'<[^>]*>','','g'),100),'Ohne Titel');
 prio := CASE WHEN coalesce(n.priority_level,0)<=1 THEN 'low' WHEN n.priority_level=2 THEN 'medium' ELSE 'high' END;
 IF p_kind='task' THEN
  IF n.task_id IS NOT NULL THEN RETURN n.task_id; END IF;
  INSERT INTO tasks(user_id,tenant_id,title,description,assigned_to,priority,category,status,source_type,source_id)
   VALUES(auth.uid(),n.tenant_id,headline,n.content,auth.uid()::text,prio,'personal','todo','quick_note',n.id) RETURNING id INTO result;
  UPDATE quick_notes SET task_id=result WHERE id=n.id;
 ELSIF p_kind='case' THEN
  IF n.case_item_id IS NOT NULL THEN RETURN n.case_item_id; END IF;
  INSERT INTO case_items(user_id,tenant_id,owner_user_id,subject,summary,status,priority,source_channel,intake_payload)
   VALUES(auth.uid(),n.tenant_id,auth.uid(),headline,n.content,'neu',prio,'other',jsonb_build_object('source_note_id',n.id)) RETURNING id INTO result;
  UPDATE quick_notes SET case_item_id=result WHERE id=n.id;
 ELSE RAISE EXCEPTION 'Unbekannter Zieltyp'; END IF;
 RETURN result;
END $$;

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
DROP FUNCTION IF EXISTS public.batch_task_stafette_preview(uuid, uuid[], text);
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
DROP FUNCTION IF EXISTS public.batch_task_stafette_action(uuid, uuid[], text);
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
DROP FUNCTION IF EXISTS public.undo_task_batch_action(uuid);
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

REVOKE ALL ON FUNCTION public.create_note_work(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_note_work(uuid, text) TO authenticated;

-- Ohne diesen Anstoß bleibt ein schon gelaufener Schema-Cache stehen und die
-- Funktionen sind weiter unbekannt, obwohl sie in der Datenbank existieren.
NOTIFY pgrst, 'reload schema';
