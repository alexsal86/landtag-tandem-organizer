ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reminder_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.dispatch_due_task_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; n int := 0; target uuid;
BEGIN
  FOR t IN SELECT id, title, user_id, ball_assignee_id, reminder_note, reminder_at FROM tasks
    WHERE reminder_at IS NOT NULL AND reminder_at <= now() AND status <> 'completed'
      AND (reminder_notified_at IS NULL OR reminder_notified_at < reminder_at)
    LIMIT 500
  LOOP
    target := COALESCE(t.ball_assignee_id, t.user_id);
    BEGIN
      PERFORM create_notification(target, 'task_due', 'Erinnerung: ' || t.title, COALESCE(t.reminder_note, 'Diese Aufgabe wartet auf dich.'), jsonb_build_object('task_id', t.id, 'reminder', true), 'high');
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'reminder notify failed: %', SQLERRM; END;
    UPDATE tasks SET reminder_notified_at = now() WHERE id = t.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispatch_due_task_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('dispatch-task-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-task-reminders');
SELECT cron.schedule('dispatch-task-reminders', '0 * * * *', $$SELECT public.dispatch_due_task_reminders();$$);