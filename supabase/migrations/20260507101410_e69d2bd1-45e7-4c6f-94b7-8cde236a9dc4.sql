-- Contact briefing memory: pinned, persistent knowledge per contact
CREATE TABLE public.contact_briefing_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('position','talking_point','qa','sensitive','role_note')),
  content TEXT,
  question TEXT,
  answer TEXT,
  source_preparation_id UUID,
  pinned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cbm_contact ON public.contact_briefing_memory (contact_id);
CREATE INDEX idx_cbm_tenant ON public.contact_briefing_memory (tenant_id);

ALTER TABLE public.contact_briefing_memory ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped access via existing helper (assumes user_belongs_to_tenant exists; fall back to direct tenant match)
CREATE POLICY "cbm_select_tenant"
  ON public.contact_briefing_memory FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "cbm_insert_tenant"
  ON public.contact_briefing_memory FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "cbm_update_tenant"
  ON public.contact_briefing_memory FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "cbm_delete_tenant"
  ON public.contact_briefing_memory FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER trg_cbm_updated_at
  BEFORE UPDATE ON public.contact_briefing_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();