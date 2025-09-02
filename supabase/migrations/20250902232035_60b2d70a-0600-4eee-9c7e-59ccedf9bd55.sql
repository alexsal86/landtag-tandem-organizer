-- Update existing documents to have tenant_id if missing
UPDATE public.knowledge_documents 
SET tenant_id = (
  SELECT get_user_primary_tenant_id(created_by)
) 
WHERE tenant_id IS NULL;

-- Make sure tenant_id is not null
ALTER TABLE public.knowledge_documents 
ALTER COLUMN tenant_id SET NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can access published documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can manage their own documents" ON public.knowledge_documents;

-- Create new tenant-based RLS policies  
CREATE POLICY "Users can view documents in their tenant" 
ON public.knowledge_documents 
FOR SELECT 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
  (is_published = true OR created_by = auth.uid() OR 
   can_access_knowledge_document(id, auth.uid()))
);

CREATE POLICY "Users can create documents in their tenant" 
ON public.knowledge_documents 
FOR INSERT 
WITH CHECK (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
  created_by = auth.uid()
);

CREATE POLICY "Users can update their own documents" 
ON public.knowledge_documents 
FOR UPDATE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
  can_edit_knowledge_document(id, auth.uid())
);

CREATE POLICY "Users can delete their own documents" 
ON public.knowledge_documents 
FOR DELETE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
  created_by = auth.uid()
);