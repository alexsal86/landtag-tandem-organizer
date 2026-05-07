CREATE TABLE public.facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  text text NOT NULL,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  valid_until date,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_facts_tenant ON public.facts(tenant_id) WHERE is_archived = false;
CREATE INDEX idx_facts_dossier ON public.facts(dossier_id) WHERE dossier_id IS NOT NULL;
CREATE INDEX idx_facts_contact ON public.facts(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_facts_tags ON public.facts USING GIN(tags);

ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view facts"
ON public.facts FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Tenant members can insert facts"
ON public.facts FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Tenant members can update facts"
ON public.facts FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Tenant members can delete facts"
ON public.facts FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE TRIGGER update_facts_updated_at
BEFORE UPDATE ON public.facts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.increment_fact_usage(_fact_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.facts
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = _fact_id
    AND tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    );
$$;