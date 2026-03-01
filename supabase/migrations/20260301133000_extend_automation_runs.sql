-- Extend automation execution logging with idempotency and step-level traces
ALTER TABLE public.automation_rule_runs
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_rule_runs_rule_idempotency
ON public.automation_rule_runs(rule_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.automation_rule_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_rule_runs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rule_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation run steps in their tenant"
ON public.automation_rule_run_steps
FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage automation run steps"
ON public.automation_rule_run_steps
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_automation_rule_run_steps_run_id
ON public.automation_rule_run_steps(run_id);
