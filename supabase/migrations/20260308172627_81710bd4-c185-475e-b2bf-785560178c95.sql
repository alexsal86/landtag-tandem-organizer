
-- Table: automation_rule_versions
CREATE TABLE public.automation_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  module text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, version_number)
);

-- RLS
ALTER TABLE public.automation_rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view versions"
  ON public.automation_rule_versions FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant members can insert versions"
  ON public.automation_rule_versions FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Auto-versioning trigger
CREATE OR REPLACE FUNCTION public.auto_version_automation_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO _next_version
  FROM public.automation_rule_versions
  WHERE rule_id = OLD.id;

  INSERT INTO public.automation_rule_versions (
    rule_id, tenant_id, version_number,
    name, description, module, trigger_type,
    trigger_config, conditions, actions, enabled,
    created_by
  ) VALUES (
    OLD.id, OLD.tenant_id, _next_version,
    OLD.name, OLD.description, OLD.module, OLD.trigger_type,
    OLD.trigger_config, OLD.conditions, OLD.actions, OLD.enabled,
    OLD.created_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_version_automation_rule ON public.automation_rules;
CREATE TRIGGER trg_auto_version_automation_rule
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_version_automation_rule();
