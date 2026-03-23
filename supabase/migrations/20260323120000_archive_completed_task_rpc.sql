-- Atomically archive completed tasks (including descendant subtasks) in a single transaction.
-- If any insert/delete fails, Postgres rolls back the entire RPC so no partial archive remains.
ALTER TABLE public.archived_tasks
  DROP CONSTRAINT IF EXISTS archived_tasks_task_id_fkey;

CREATE OR REPLACE FUNCTION public.archive_completed_task(
  p_task_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_task public.tasks%ROWTYPE;
  v_archived_root_id uuid;
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'User mismatch for task archive request'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_root_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', p_task_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_root_task.user_id <> v_actor_id
     AND NOT EXISTS (
       SELECT 1
       FROM unnest(
         regexp_split_to_array(
           regexp_replace(coalesce(v_root_task.assigned_to, ''), '[{}[:space:]]', '', 'g'),
           ','
         )
       ) AS assignee(user_id_text)
       WHERE assignee.user_id_text = v_actor_id::text
     ) THEN
    RAISE EXCEPTION 'Not authorized to archive task %', p_task_id
      USING ERRCODE = '42501';
  END IF;

  WITH RECURSIVE task_tree AS (
    SELECT t.*
    FROM public.tasks t
    WHERE t.id = p_task_id

    UNION ALL

    SELECT child.*
    FROM public.tasks child
    INNER JOIN task_tree parent ON child.parent_task_id = parent.id
  ), archived_rows AS (
    INSERT INTO public.archived_tasks (
      task_id,
      user_id,
      title,
      description,
      priority,
      category,
      assigned_to,
      progress,
      due_date,
      completed_at,
      archived_at,
      auto_delete_after_days
    )
    SELECT
      tree.id,
      p_user_id,
      tree.title,
      tree.description,
      tree.priority,
      coalesce(tree.category, 'personal'),
      tree.assigned_to,
      coalesce(tree.progress, CASE WHEN tree.status = 'completed' THEN 100 ELSE 0 END),
      tree.due_date,
      now(),
      now(),
      NULL
    FROM task_tree tree
    RETURNING id, task_id
  ), deleted_snoozes AS (
    DELETE FROM public.task_snoozes snoozes
    WHERE snoozes.task_id IN (SELECT task_id FROM archived_rows)
    RETURNING snoozes.task_id
  ), deleted_tasks AS (
    DELETE FROM public.tasks task_row
    WHERE task_row.id IN (SELECT task_id FROM archived_rows)
    RETURNING task_row.id
  )
  SELECT archived.id
    INTO v_archived_root_id
  FROM archived_rows archived
  WHERE archived.task_id = p_task_id
  LIMIT 1;

  IF v_archived_root_id IS NULL THEN
    RAISE EXCEPTION 'Archive operation did not persist task %', p_task_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_archived_root_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_completed_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_completed_task(uuid, uuid) TO authenticated;
