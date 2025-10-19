-- Tabelle für Dokument-Kontakt-Beziehungen
CREATE TABLE IF NOT EXISTS public.document_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'related',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(document_id, contact_id)
);

-- Indexes für Performance
CREATE INDEX idx_document_contacts_document_id ON public.document_contacts(document_id);
CREATE INDEX idx_document_contacts_contact_id ON public.document_contacts(contact_id);

-- RLS aktivieren
ALTER TABLE public.document_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view document contacts in their tenant"
  ON public.document_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_contacts.document_id
      AND d.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can create document contacts in their tenant"
  ON public.document_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_contacts.document_id
      AND d.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update document contacts in their tenant"
  ON public.document_contacts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_contacts.document_id
      AND d.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete document contacts in their tenant"
  ON public.document_contacts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_contacts.document_id
      AND d.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    )
  );