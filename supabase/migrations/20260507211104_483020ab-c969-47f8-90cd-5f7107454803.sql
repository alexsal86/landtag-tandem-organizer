-- Onboarding-Checkliste pro User+Tenant: speichert erledigte Items als Map.
ALTER TABLE public.user_onboarding_state
  ADD COLUMN IF NOT EXISTS checklist_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_dismissed_at TIMESTAMPTZ;

-- Tenant-konfigurierbare Checklisten-Items (optional, sonst Defaults).
CREATE TABLE IF NOT EXISTS public.tenant_onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  cta_route TEXT,
  position INT NOT NULL DEFAULT 0,
  required_role TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, item_key)
);

CREATE INDEX IF NOT EXISTS tenant_onboarding_checklist_items_tenant_idx
  ON public.tenant_onboarding_checklist_items(tenant_id, position);

ALTER TABLE public.tenant_onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select_own_tenant"
  ON public.tenant_onboarding_checklist_items FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "checklist_items_admin_write"
  ON public.tenant_onboarding_checklist_items FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'abgeordneter'::app_role)
      OR public.has_role(auth.uid(), 'bueroleitung'::app_role)
    )
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'abgeordneter'::app_role)
      OR public.has_role(auth.uid(), 'bueroleitung'::app_role)
    )
  );

DROP TRIGGER IF EXISTS checklist_items_touch ON public.tenant_onboarding_checklist_items;
CREATE TRIGGER checklist_items_touch BEFORE UPDATE ON public.tenant_onboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();