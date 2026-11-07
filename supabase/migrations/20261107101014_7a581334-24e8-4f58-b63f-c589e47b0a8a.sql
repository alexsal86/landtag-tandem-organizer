ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ball_owner text NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS ball_assignee_id uuid,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_due date,
  ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.validate_task_ball_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ball_owner NOT IN ('office','deputy','external') THEN
    RAISE EXCEPTION 'invalid ball_owner %', NEW.ball_owner;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_task_ball_owner ON public.tasks;
CREATE TRIGGER trg_validate_task_ball_owner BEFORE INSERT OR UPDATE OF ball_owner ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_ball_owner();