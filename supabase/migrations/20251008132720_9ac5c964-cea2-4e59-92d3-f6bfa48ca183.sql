-- Tabelle für allgemeine Event Planning Dokumente
CREATE TABLE public.event_planning_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes für Performance
CREATE INDEX idx_event_planning_documents_planning_id 
  ON public.event_planning_documents(event_planning_id);

CREATE INDEX idx_event_planning_documents_tenant_id 
  ON public.event_planning_documents(tenant_id);

-- RLS Policies mit Tenant-Isolation
ALTER TABLE public.event_planning_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event planning docs in their tenant"
  ON public.event_planning_documents FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert event planning docs in their tenant"
  ON public.event_planning_documents FOR INSERT
  WITH CHECK (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete event planning docs in their tenant"
  ON public.event_planning_documents FOR DELETE
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));