ALTER TABLE public.case_items
  ADD COLUMN IF NOT EXISTS ball_owner text NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS next_action_label text,
  ADD COLUMN IF NOT EXISTS next_action_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_assignee_id uuid,
  ADD COLUMN IF NOT EXISTS parliamentary_tool text NOT NULL DEFAULT 'none';

CREATE OR REPLACE FUNCTION public.validate_case_item_ball()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ball_owner NOT IN ('office','citizen','ministry','authority','fraction','snoozed') THEN
    RAISE EXCEPTION 'invalid ball_owner %', NEW.ball_owner;
  END IF;
  IF NEW.parliamentary_tool NOT IN ('none','inquiry','onsite_visit','speech','letter') THEN
    RAISE EXCEPTION 'invalid parliamentary_tool %', NEW.parliamentary_tool;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_case_item_ball ON public.case_items;
CREATE TRIGGER trg_validate_case_item_ball BEFORE INSERT OR UPDATE OF ball_owner, parliamentary_tool
ON public.case_items FOR EACH ROW EXECUTE FUNCTION public.validate_case_item_ball();

CREATE INDEX IF NOT EXISTS idx_case_items_tenant_ball ON public.case_items(tenant_id, ball_owner);
CREATE INDEX IF NOT EXISTS idx_case_items_next_due ON public.case_items(tenant_id, next_action_due_at) WHERE next_action_due_at IS NOT NULL;