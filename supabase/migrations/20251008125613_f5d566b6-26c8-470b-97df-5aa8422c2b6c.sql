-- Create document_folders table
CREATE TABLE public.document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'folder',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint: Eindeutige Namen pro Parent-Ordner und Tenant
  UNIQUE(tenant_id, parent_folder_id, name)
);

-- RLS Policies
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view folders in their tenant"
ON public.document_folders FOR SELECT
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create folders in their tenant"
ON public.document_folders FOR INSERT
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update folders in their tenant"
ON public.document_folders FOR UPDATE
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete folders in their tenant"
ON public.document_folders FOR DELETE
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Trigger für updated_at
CREATE TRIGGER update_document_folders_updated_at
BEFORE UPDATE ON public.document_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add folder_id column to documents table
ALTER TABLE public.documents 
ADD COLUMN folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_documents_folder_id ON public.documents(folder_id);
CREATE INDEX idx_documents_tenant_folder ON public.documents(tenant_id, folder_id);
CREATE INDEX idx_document_folders_parent ON public.document_folders(parent_folder_id);
CREATE INDEX idx_document_folders_tenant ON public.document_folders(tenant_id);