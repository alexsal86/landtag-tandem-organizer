-- Aufgaben-Nachbesserungen aus dem Review:
--   * Rücknahme einer Archivierung (Undo im Toast statt Weg über den Archiv-Dialog)
--   * Eskalation einer hängenden Aufgabe an die Büroleitung
--   * Freigabe-SLA (Wartezeit bei Abgeordnete/r) als Kennzahl
--   * Altlasten: offene Büro-Aufgaben ohne namentlichen Ball bekommen eine Person

-- 1) Rücknahme: stellt den archivierten Teilbaum wieder her.
--    Der Archivbestand kennt kein tenant_id; deshalb kommt das Büro vom Aufrufer
--    und wird gegen die Mitgliedschaft geprüft. Nur wer archiviert hat (oder die
--    Büroleitung) darf zurückholen.
CREATE OR REPLACE FUNCTION public.restore_archived_task(_archived_id uuid, _tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  me uuid := auth.uid();
  root public.archived_tasks;
  row_rec record;
  my_name text;
  restored integer := 0;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_tenant_member(_tenant_id, me) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO root FROM public.archived_tasks WHERE id = _archived_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archivierte Aufgabe nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF root.user_id <> me AND NOT public.is_tenant_admin(me, _tenant_id) AND NOT public.is_superadmin(me) THEN
    RAISE EXCEPTION 'Nur wer archiviert hat (oder die Büroleitung) kann das zurücknehmen'
      USING ERRCODE = '42501';
  END IF;

  SELECT display_name INTO my_name FROM public.profiles WHERE user_id = me LIMIT 1;

  FOR row_rec IN
    WITH RECURSIVE tree AS (
      SELECT archived.*, 0 AS depth
      FROM public.archived_tasks AS archived
      WHERE archived.id = root.id
      UNION ALL
      SELECT child.*, tree.depth + 1
      FROM public.archived_tasks AS child
      JOIN tree ON child.parent_task_id = tree.task_id
      WHERE child.user_id = root.user_id
        AND child.archived_at = root.archived_at
    )
    SELECT * FROM tree ORDER BY depth, task_id
  LOOP
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = row_rec.task_id) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.tasks (
      id, title, description, status, priority, category, assigned_to, progress,
      due_date, user_id, tenant_id, parent_task_id, meeting_id, source_type, source_id,
      created_at, timeline
    ) VALUES (
      row_rec.task_id, row_rec.title, row_rec.description, 'todo', row_rec.priority,
      row_rec.category, row_rec.assigned_to, 0, row_rec.due_date, root.user_id, _tenant_id,
      row_rec.parent_task_id, row_rec.meeting_id, row_rec.source_type, row_rec.source_id,
      row_rec.created_at,
      jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text, 'type', 'system', 'at', now(),
        'actorName', my_name, 'text', 'Aus dem Archiv zurückgeholt'
      ))
    );
    DELETE FROM public.archived_tasks WHERE id = row_rec.id;
    restored := restored + 1;
  END LOOP;

  RETURN restored;
END
$$;

REVOKE ALL ON FUNCTION public.restore_archived_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_archived_task(uuid, uuid) TO authenticated;

-- 2) Eskalation: Verlaufseintrag plus Benachrichtigung der Büroleitung.
CREATE OR REPLACE FUNCTION public.escalate_task(_task_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  t public.tasks;
  me uuid := auth.uid();
  my_name text;
  recipient uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND OR NOT public.is_tenant_member(t.tenant_id, me) THEN
    RAISE EXCEPTION 'Aufgabe nicht verfügbar' USING ERRCODE = '42501';
  END IF;
  IF t.status = 'completed' THEN
    RAISE EXCEPTION 'Erledigte Aufgaben werden nicht eskaliert' USING ERRCODE = '22023';
  END IF;

  SELECT display_name INTO my_name FROM public.profiles WHERE user_id = me LIMIT 1;

  UPDATE public.tasks
  SET timeline = COALESCE(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text, 'type', 'system', 'at', now(), 'actorName', my_name,
    'text', 'Eskaliert an die Büroleitung' || COALESCE(': „' || NULLIF(trim(_note), '') || '“', '')
  ))
  WHERE id = t.id;

  FOR recipient IN
    SELECT DISTINCT membership.user_id
    FROM public.user_tenant_memberships AS membership
    WHERE membership.tenant_id = t.tenant_id
      AND membership.is_active
      AND membership.role IN ('abgeordneter', 'bueroleitung')
      AND membership.user_id <> me
  LOOP
    BEGIN
      PERFORM public.create_notification(
        recipient,
        'task_updated',
        'Eskalation: ' || t.title,
        COALESCE(my_name, 'Jemand') || ' meldet eine hängende Aufgabe'
          || COALESCE(' – ' || NULLIF(trim(_note), ''), ''),
        jsonb_build_object('task_id', t.id, 'escalated', true),
        'high',
        -- 7-stellige Variante: Büro der Aufgabe statt des Hauptbüros der Person.
        t.tenant_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'escalate notify failed: %', SQLERRM;
    END;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.escalate_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escalate_task(uuid, text) TO authenticated;

-- 3) Freigabe-SLA: wie lange liegt der Ball bei Abgeordnete/r?
CREATE OR REPLACE FUNCTION public.task_approval_sla(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  waiting jsonb;
  completed jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'count', count(*),
    'over_seven_days', count(*) FILTER (
      WHERE now() - COALESCE(ball_handed_at, created_at) > interval '7 days'
    ),
    'median_days', COALESCE(round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY extract(epoch FROM now() - COALESCE(ball_handed_at, created_at)) / 86400
    )::numeric, 1), 0),
    'items', COALESCE(jsonb_agg(jsonb_build_object(
      'task_id', id,
      'title', title,
      'days', floor(extract(epoch FROM now() - COALESCE(ball_handed_at, created_at)) / 86400)::integer,
      'assignee_id', ball_assignee_id
    ) ORDER BY COALESCE(ball_handed_at, created_at)), '[]'::jsonb)
  )
  INTO waiting
  FROM public.tasks
  WHERE tenant_id = _tenant_id
    AND status <> 'completed'
    AND ball_owner = 'deputy'
    AND parent_task_id IS NULL;

  SELECT jsonb_build_object(
    'count', count(*),
    'median_days', COALESCE(round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY extract(epoch FROM completed_at - ball_handed_at) / 86400
    )::numeric, 1), 0)
  )
  INTO completed
  FROM public.tasks
  WHERE tenant_id = _tenant_id
    AND status = 'completed'
    AND ball_handed_at IS NOT NULL
    AND completed_at IS NOT NULL
    AND completed_at > now() - interval '90 days';

  RETURN jsonb_build_object('waiting', waiting, 'completed_90d', completed);
END
$$;

REVOKE ALL ON FUNCTION public.task_approval_sla(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_approval_sla(uuid) TO authenticated;

-- 4) Altlasten: offene Büro-Aufgaben ohne Person gehören der Person, die sie
--    angelegt hat – sofern sie noch aktiv im Büro ist. Vorher standen sie bei
--    allen gleichzeitig unter "Mein Zug".
UPDATE public.tasks AS task
SET ball_assignee_id = task.user_id
WHERE task.ball_owner = 'office'
  AND task.ball_assignee_id IS NULL
  AND task.status <> 'completed'
  AND task.parent_task_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships AS membership
    WHERE membership.tenant_id = task.tenant_id
      AND membership.user_id = task.user_id
      AND membership.is_active
  );
