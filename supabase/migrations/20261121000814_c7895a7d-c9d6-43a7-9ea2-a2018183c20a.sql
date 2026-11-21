WITH migrated AS (
  SELECT
    tt.id,
    tt.tenant_id,
    tt.title,
    tt.description,
    tt.first_step,
    tt.due_in_days,
    tt.subtasks,
    tt.is_active,
    tt.created_at,
    tt.updated_at,
    COALESCE(
      tt.created_by,
      (SELECT m.user_id FROM public.user_tenant_memberships m
       WHERE m.tenant_id = tt.tenant_id AND m.is_active = true
       ORDER BY CASE WHEN m.role IN ('abgeordneter','bueroleitung') THEN 0 ELSE 1 END, m.user_id
       LIMIT 1),
      (SELECT u.id FROM auth.users u WHERE public.is_superadmin(u.id) ORDER BY u.created_at LIMIT 1)
    ) AS rule_creator
  FROM public.task_templates tt
)
INSERT INTO public.automation_rules
  (id, tenant_id, name, description, module, trigger_type, trigger_config, conditions, actions, enabled, created_by, created_at, updated_at)
SELECT
  id,
  tenant_id,
  title,
  description,
  'tasks',
  'manual',
  '{"field":"status","value":""}'::jsonb,
  '{"all":[]}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'type', 'create_task_package',
    'payload', jsonb_build_object(
      'title', title,
      'description', description,
      'first_step', first_step,
      'due_in_days', due_in_days::text,
      'subtasks', subtasks::text
    )
  )),
  is_active,
  rule_creator,
  created_at,
  updated_at
FROM migrated
WHERE rule_creator IS NOT NULL
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE expected_count integer; migrated_count integer;
BEGIN
  SELECT count(*) INTO expected_count FROM public.task_templates;
  SELECT count(*) INTO migrated_count
  FROM public.task_templates tt
  JOIN public.automation_rules r ON r.id = tt.id AND r.tenant_id = tt.tenant_id
  WHERE r.trigger_type = 'manual'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.actions) a WHERE a->>'type' = 'create_task_package');
  IF migrated_count <> expected_count THEN
    RAISE EXCEPTION 'Aufgabenpaket-Migration unvollständig: % von % übernommen', migrated_count, expected_count;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.execute_task_package(
  _rule_id uuid,
  _actor_user_id uuid,
  _start_date date DEFAULT current_date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rule_row public.automation_rules%ROWTYPE;
  package_action jsonb;
  payload jsonb;
  steps jsonb;
  step jsonb;
  parent_id uuid := gen_random_uuid();
  start_day date := COALESCE(_start_date, current_date);
  package_title text;
  package_description text;
  first_step text;
  due_days integer;
BEGIN
  SELECT * INTO rule_row FROM public.automation_rules WHERE id = _rule_id AND enabled = true;
  IF rule_row.id IS NULL OR rule_row.module <> 'tasks' THEN
    RAISE EXCEPTION 'Aufgabenpaket-Regel nicht gefunden oder pausiert';
  END IF;
  IF _actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = rule_row.tenant_id AND m.user_id = _actor_user_id AND m.is_active = true
  ) THEN
    RAISE EXCEPTION 'Keine aktive Büromitgliedschaft für dieses Aufgabenpaket';
  END IF;

  SELECT value INTO package_action
  FROM jsonb_array_elements(rule_row.actions)
  WHERE value->>'type' = 'create_task_package'
  LIMIT 1;
  IF package_action IS NULL THEN
    RAISE EXCEPTION 'Die Regel enthält kein Aufgabenpaket';
  END IF;
  payload := COALESCE(package_action->'payload', '{}'::jsonb);
  package_title := trim(COALESCE(payload->>'title', rule_row.name));
  package_description := trim(COALESCE(payload->>'description', rule_row.description, ''));
  first_step := trim(COALESCE(payload->>'first_step', ''));
  due_days := COALESCE((payload->>'due_in_days')::integer, 7);
  steps := CASE
    WHEN jsonb_typeof(payload->'subtasks') = 'array' THEN payload->'subtasks'
    WHEN COALESCE(payload->>'subtasks', '') = '' THEN '[]'::jsonb
    ELSE (payload->>'subtasks')::jsonb
  END;

  IF length(package_title) < 2 OR length(first_step) < 2 THEN
    RAISE EXCEPTION 'Titel und erster Schritt sind erforderlich';
  END IF;
  IF due_days < 0 OR due_days > 365 THEN
    RAISE EXCEPTION 'Die Gesamtfrist muss zwischen 0 und 365 Tagen liegen';
  END IF;
  IF jsonb_typeof(steps) <> 'array' OR jsonb_array_length(steps) > 30 THEN
    RAISE EXCEPTION 'Unteraufgaben müssen eine Liste mit höchstens 30 Einträgen sein';
  END IF;
  FOR step IN SELECT value FROM jsonb_array_elements(steps) LOOP
    IF jsonb_typeof(step) <> 'object'
       OR length(trim(COALESCE(step->>'title', ''))) < 2
       OR COALESCE((step->>'offsetDays')::integer, -1) < 0
       OR (step->>'offsetDays')::integer > 365 THEN
      RAISE EXCEPTION 'Jede Unteraufgabe benötigt Titel und Frist zwischen 0 und 365 Tagen';
    END IF;
  END LOOP;

  INSERT INTO public.tasks
    (id, tenant_id, user_id, assigned_to, title, description, status, priority, category,
     due_date, next_action, ball_owner, ball_assignee_id, source_type, source_id, timeline)
  VALUES
    (parent_id, rule_row.tenant_id, _actor_user_id, _actor_user_id::text, package_title,
     package_description, 'todo', 'medium', 'personal', (start_day + due_days)::timestamptz,
     first_step, 'office', _actor_user_id, 'automation_rule', rule_row.id,
     jsonb_build_array(jsonb_build_object(
       'id', gen_random_uuid(), 'at', now(), 'type', 'system',
       'text', 'Aufgabenpaket über Regel „' || rule_row.name || '“ gestartet'
     )));

  INSERT INTO public.tasks
    (tenant_id, user_id, assigned_to, title, description, status, priority, category, due_date, parent_task_id)
  SELECT
    rule_row.tenant_id, _actor_user_id, _actor_user_id::text, trim(s.value->>'title'), NULL,
    'todo', 'medium', 'personal', (start_day + (s.value->>'offsetDays')::integer)::timestamptz, parent_id
  FROM jsonb_array_elements(steps) s(value);

  RETURN parent_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_task_package(uuid,uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_task_package(uuid,uuid,date) TO service_role;

DROP FUNCTION public.apply_task_template(uuid,date);
DROP FUNCTION public.save_task_template(uuid,uuid,text,text,text,integer,jsonb,boolean);
DROP FUNCTION public.delete_task_template(uuid);
DROP TABLE public.task_templates;