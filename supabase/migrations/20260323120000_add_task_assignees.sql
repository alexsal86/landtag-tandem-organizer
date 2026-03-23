BEGIN;

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view task assignees in their tenants" ON public.task_assignees;
CREATE POLICY "Users can view task assignees in their tenants"
ON public.task_assignees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Users can create task assignees in their tenants" ON public.task_assignees;
CREATE POLICY "Users can create task assignees in their tenants"
ON public.task_assignees FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Users can update task assignees in their tenants" ON public.task_assignees;
CREATE POLICY "Users can update task assignees in their tenants"
ON public.task_assignees FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Users can delete task assignees in their tenants" ON public.task_assignees;
CREATE POLICY "Users can delete task assignees in their tenants"
ON public.task_assignees FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
      )
  )
);

CREATE OR REPLACE FUNCTION public.parse_task_assignee_ids(p_assigned_to text)
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT cleaned::uuid), ARRAY[]::uuid[])
  FROM (
    SELECT NULLIF(btrim(value), '') AS cleaned
    FROM unnest(
      string_to_array(replace(replace(COALESCE(p_assigned_to, ''), '{', ''), '}', ''), ',')
    ) AS value
  ) parsed
  WHERE cleaned IS NOT NULL
    AND cleaned ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

CREATE OR REPLACE FUNCTION public.sync_task_assignees_from_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parsed_ids uuid[];
BEGIN
  parsed_ids := public.parse_task_assignee_ids(NEW.assigned_to);

  DELETE FROM public.task_assignees WHERE task_id = NEW.id;

  IF COALESCE(array_length(parsed_ids, 1), 0) > 0 THEN
    INSERT INTO public.task_assignees (task_id, user_id, assigned_by, created_at)
    SELECT NEW.id, assignee_id, COALESCE(NEW.user_id, auth.uid()), COALESCE(NEW.created_at, now())
    FROM unnest(parsed_ids) AS assignee_id
    ON CONFLICT (task_id, user_id) DO UPDATE
      SET assigned_by = EXCLUDED.assigned_by;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_legacy_assigned_to()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_task_id uuid;
  assignee_values text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT CASE
    WHEN COUNT(*) = 0 THEN NULL
    WHEN COUNT(*) = 1 THEN MIN(user_id)::text
    ELSE '{' || string_agg(user_id::text, ',' ORDER BY created_at, user_id::text) || '}'
  END
  INTO assignee_values
  FROM public.task_assignees
  WHERE task_id = target_task_id;

  UPDATE public.tasks
  SET assigned_to = assignee_values
  WHERE id = target_task_id
    AND assigned_to IS DISTINCT FROM assignee_values;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_assignees_from_task ON public.tasks;
CREATE TRIGGER trg_sync_task_assignees_from_task
AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_assignees_from_task();

DROP TRIGGER IF EXISTS trg_sync_task_legacy_assigned_to_ins ON public.task_assignees;
CREATE TRIGGER trg_sync_task_legacy_assigned_to_ins
AFTER INSERT ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_legacy_assigned_to();

DROP TRIGGER IF EXISTS trg_sync_task_legacy_assigned_to_upd ON public.task_assignees;
CREATE TRIGGER trg_sync_task_legacy_assigned_to_upd
AFTER UPDATE ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_legacy_assigned_to();

DROP TRIGGER IF EXISTS trg_sync_task_legacy_assigned_to_del ON public.task_assignees;
CREATE TRIGGER trg_sync_task_legacy_assigned_to_del
AFTER DELETE ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_legacy_assigned_to();

INSERT INTO public.task_assignees (task_id, user_id, assigned_by, created_at)
SELECT t.id, assignee_id, t.user_id, t.created_at
FROM public.tasks t
CROSS JOIN LATERAL unnest(public.parse_task_assignee_ids(t.assigned_to)) AS assignee_id
ON CONFLICT (task_id, user_id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;

COMMIT;
