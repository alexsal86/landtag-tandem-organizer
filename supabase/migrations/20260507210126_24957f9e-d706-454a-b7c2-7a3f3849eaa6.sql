-- 1. Erweiterungen workflow_definitions
ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS cron_expression TEXT,
  ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

-- Validierungs-Trigger statt CHECK (CHECK kann bei Cron-Strings keine Form prüfen)
CREATE OR REPLACE FUNCTION public.validate_workflow_definition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.trigger_type = 'schedule_cron' THEN
    IF NEW.cron_expression IS NULL OR length(trim(NEW.cron_expression)) = 0 THEN
      RAISE EXCEPTION 'cron_expression ist bei trigger_type=schedule_cron erforderlich';
    END IF;
  ELSE
    IF NEW.cron_expression IS NOT NULL THEN
      RAISE EXCEPTION 'cron_expression nur bei trigger_type=schedule_cron erlaubt';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_workflow_definition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_workflow_definition_trigger ON public.workflow_definitions;
CREATE TRIGGER validate_workflow_definition_trigger
BEFORE INSERT OR UPDATE ON public.workflow_definitions
FOR EACH ROW
EXECUTE FUNCTION public.validate_workflow_definition();

-- Index für Cron-Worker
CREATE INDEX IF NOT EXISTS workflow_definitions_active_trigger_idx
  ON public.workflow_definitions(is_active, trigger_type)
  WHERE is_active = true;

-- 2. Erweiterungen workflow_runs
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS step_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workflow_runs_parent_run_idx
  ON public.workflow_runs(parent_run_id)
  WHERE parent_run_id IS NOT NULL;