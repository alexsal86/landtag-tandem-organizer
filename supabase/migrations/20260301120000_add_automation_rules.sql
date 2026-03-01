-- No-code automation rule engine foundation
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('record_changed', 'schedule', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{"all":[]}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_rule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'dry_run')),
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation rules in their tenant"
ON public.automation_rules
FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage automation rules"
ON public.automation_rules
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Users can view automation runs in their tenant"
ON public.automation_rule_runs
FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can create automation runs"
ON public.automation_rule_runs
FOR INSERT
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update automation runs"
ON public.automation_rule_runs
FOR UPDATE
USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON public.automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON public.automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_rule_id ON public.automation_rule_runs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_tenant ON public.automation_rule_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_started_at ON public.automation_rule_runs(started_at DESC);

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
