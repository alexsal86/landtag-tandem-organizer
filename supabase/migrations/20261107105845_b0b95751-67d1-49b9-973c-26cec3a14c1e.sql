ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_rule text;

CREATE OR REPLACE FUNCTION public.validate_task_recurrence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.recurrence_rule IS NOT NULL AND NEW.recurrence_rule NOT IN ('weekly','biweekly','monthly','quarterly','yearly') THEN
    RAISE EXCEPTION 'Ungültige Wiederholung: %', NEW.recurrence_rule;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_task_recurrence ON public.tasks;
CREATE TRIGGER trg_validate_task_recurrence BEFORE INSERT OR UPDATE OF recurrence_rule ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_recurrence();

CREATE OR REPLACE FUNCTION public.next_recurrence_date(_base timestamptz, _rule text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _base + CASE _rule
    WHEN 'weekly' THEN interval '7 days'
    WHEN 'biweekly' THEN interval '14 days'
    WHEN 'monthly' THEN interval '1 month'
    WHEN 'quarterly' THEN interval '3 months'
    WHEN 'yearly' THEN interval '1 year' END
$$;

CREATE OR REPLACE FUNCTION public.spawn_recurring_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base timestamptz; new_id uuid := gen_random_uuid();
BEGIN
  IF NEW.recurrence_rule IS NULL OR NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  base := GREATEST(COALESCE(NEW.due_date::timestamptz, now()), date_trunc('day', now()) - interval '1 day');
  INSERT INTO tasks (id, title, description, priority, category, status, user_id, tenant_id, assigned_to, due_date,
    recurrence_rule, ball_owner, ball_assignee_id, checklist, parent_task_id, timeline)
  VALUES (new_id, NEW.title, NEW.description, NEW.priority, NEW.category, 'todo', NEW.user_id, NEW.tenant_id, NEW.assigned_to,
    next_recurrence_date(base, NEW.recurrence_rule), NEW.recurrence_rule, 'office', NEW.ball_assignee_id,
    COALESCE((SELECT jsonb_agg(e || jsonb_build_object('done', false)) FROM jsonb_array_elements(COALESCE(NEW.checklist,'[]'::jsonb)) e), '[]'::jsonb),
    NEW.parent_task_id,
    jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system', 'at', now(), 'text', 'Wiederkehrende Aufgabe automatisch neu angelegt')));
  INSERT INTO task_assignees (task_id, user_id)
    SELECT new_id, user_id FROM task_assignees WHERE task_id = NEW.id ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.spawn_recurring_task() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_spawn_recurring_task ON public.tasks;
CREATE TRIGGER trg_spawn_recurring_task AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.spawn_recurring_task();