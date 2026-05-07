-- Tenant-spezifische Onboarding-Slides
CREATE TABLE public.tenant_onboarding_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  icon text,
  accent text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_tenant_onboarding_slides_tenant ON public.tenant_onboarding_slides(tenant_id, position);

ALTER TABLE public.tenant_onboarding_slides ENABLE ROW LEVEL SECURITY;

-- Lesen: alle Mitglieder des Tenants
CREATE POLICY "Tenant members can view onboarding slides"
ON public.tenant_onboarding_slides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = tenant_onboarding_slides.tenant_id
      AND m.user_id = auth.uid()
  )
);

-- Schreiben: nur abgeordneter / bueroleitung im jeweiligen Tenant
CREATE POLICY "Office leads can insert onboarding slides"
ON public.tenant_onboarding_slides
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = tenant_onboarding_slides.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('abgeordneter', 'bueroleitung')
  )
);

CREATE POLICY "Office leads can update onboarding slides"
ON public.tenant_onboarding_slides
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = tenant_onboarding_slides.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('abgeordneter', 'bueroleitung')
  )
);

CREATE POLICY "Office leads can delete onboarding slides"
ON public.tenant_onboarding_slides
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = tenant_onboarding_slides.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('abgeordneter', 'bueroleitung')
  )
);

CREATE TRIGGER trg_tenant_onboarding_slides_updated_at
BEFORE UPDATE ON public.tenant_onboarding_slides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Completion-State pro (user, tenant)
CREATE TABLE public.user_onboarding_state (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

ALTER TABLE public.user_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding state"
ON public.user_onboarding_state
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own onboarding state"
ON public.user_onboarding_state
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own onboarding state"
ON public.user_onboarding_state
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users delete own onboarding state"
ON public.user_onboarding_state
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_user_onboarding_state_updated_at
BEFORE UPDATE ON public.user_onboarding_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();