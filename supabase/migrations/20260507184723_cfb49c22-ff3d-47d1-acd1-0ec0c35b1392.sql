
-- ============================================================
-- workflow_definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,            -- 'case_created' | 'task_created' | 'cron' | 'manual'
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Array von {field, op, value}
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,     -- Array von {type, config}
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant ON public.workflow_definitions (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_trigger ON public.workflow_definitions (trigger_type, is_active);

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wf_def_select" ON public.workflow_definitions;
CREATE POLICY "wf_def_select" ON public.workflow_definitions
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "wf_def_modify" ON public.workflow_definitions;
CREATE POLICY "wf_def_modify" ON public.workflow_definitions
FOR ALL TO authenticated
USING (
  public.is_tenant_member(tenant_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships utm
    WHERE utm.tenant_id = workflow_definitions.tenant_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
      AND utm.role IN ('abgeordneter','bueroleitung')
  )
)
WITH CHECK (
  public.is_tenant_member(tenant_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships utm
    WHERE utm.tenant_id = workflow_definitions.tenant_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
      AND utm.role IN ('abgeordneter','bueroleitung')
  )
);

-- ============================================================
-- workflow_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  trigger_type text NOT NULL,
  trigger_payload jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|running|success|failed|skipped
  result jsonb,
  error text,
  is_dry_run boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON public.workflow_runs (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs (workflow_id, started_at DESC);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wf_run_select" ON public.workflow_runs;
CREATE POLICY "wf_run_select" ON public.workflow_runs
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "wf_run_insert_service" ON public.workflow_runs;
CREATE POLICY "wf_run_insert_service" ON public.workflow_runs
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "wf_run_update_service" ON public.workflow_runs;
CREATE POLICY "wf_run_update_service" ON public.workflow_runs
FOR UPDATE TO service_role USING (true);

-- ============================================================
-- workflow_action_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_action_log_run ON public.workflow_action_log (run_id, step_index);

ALTER TABLE public.workflow_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wf_log_select" ON public.workflow_action_log;
CREATE POLICY "wf_log_select" ON public.workflow_action_log
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workflow_runs r
    WHERE r.id = workflow_action_log.run_id
      AND public.is_tenant_member(r.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "wf_log_insert_service" ON public.workflow_action_log;
CREATE POLICY "wf_log_insert_service" ON public.workflow_action_log
FOR INSERT TO service_role WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_workflow_definitions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_workflow_definitions ON public.workflow_definitions;
CREATE TRIGGER trg_touch_workflow_definitions
BEFORE UPDATE ON public.workflow_definitions
FOR EACH ROW EXECUTE FUNCTION public.touch_workflow_definitions();

-- ============================================================
-- Dispatch-Trigger (ruft Edge Function via pg_net auf)
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_workflow_trigger(
  _trigger_type text,
  _tenant_id uuid,
  _entity_id uuid,
  _payload jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Konfig aus vault.decrypted_secrets (von dispatch-mobile-push übernommenes Schema)
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN; -- Vault nicht konfiguriert – stillschweigend überspringen
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/workflow-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'trigger_type', _trigger_type,
      'tenant_id', _tenant_id,
      'entity_id', _entity_id,
      'payload', _payload
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Workflow-Trigger darf den ursprünglichen Insert niemals blockieren
  RAISE NOTICE 'workflow dispatch failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_workflow_on_case_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_workflow_trigger(
    'case_created',
    NEW.tenant_id,
    NEW.id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_dispatch_case_item ON public.case_items;
CREATE TRIGGER trg_workflow_dispatch_case_item
AFTER INSERT ON public.case_items
FOR EACH ROW EXECUTE FUNCTION public.trg_workflow_on_case_created();

CREATE OR REPLACE FUNCTION public.trg_workflow_on_task_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_workflow_trigger(
    'task_created',
    NEW.tenant_id,
    NEW.id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_dispatch_task ON public.tasks;
CREATE TRIGGER trg_workflow_dispatch_task
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_workflow_on_task_created();

-- ============================================================
-- Cleanup
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_workflow_runs()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.workflow_runs WHERE started_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workflow-runs-cleanup') THEN
    PERFORM cron.schedule(
      'workflow-runs-cleanup',
      '0 4 * * *',
      $cron$ SELECT public.cleanup_workflow_runs(); $cron$
    );
  END IF;
END $$;

-- Berechtigungen härten
REVOKE ALL ON FUNCTION public.dispatch_workflow_trigger(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_workflow_runs() FROM PUBLIC, anon, authenticated;
