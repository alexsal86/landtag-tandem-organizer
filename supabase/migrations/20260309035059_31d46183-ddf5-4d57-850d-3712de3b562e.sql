
-- Version history for knowledge documents
CREATE TABLE public.knowledge_document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_html TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_summary TEXT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE(document_id, version_number)
);

-- Index for fast lookups
CREATE INDEX idx_knowledge_doc_versions_document ON public.knowledge_document_versions(document_id, version_number DESC);

-- RLS
ALTER TABLE public.knowledge_document_versions ENABLE ROW LEVEL SECURITY;

-- Users can read versions of documents they can access
CREATE POLICY "Users can read versions of accessible documents"
  ON public.knowledge_document_versions
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_knowledge_document(document_id, auth.uid())
  );

-- Users can insert versions for documents they can edit
CREATE POLICY "Users can insert versions for editable documents"
  ON public.knowledge_document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_edit_knowledge_document(document_id, auth.uid())
    AND created_by = auth.uid()
  );
