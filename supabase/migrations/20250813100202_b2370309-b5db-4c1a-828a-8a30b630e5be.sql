-- Drop all existing policies for knowledge_documents to fix infinite recursion
DROP POLICY IF EXISTS "knowledge_documents_select_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_insert_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_update_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_delete_policy" ON public.knowledge_documents;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS public.can_access_knowledge_document(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_edit_knowledge_document(uuid, uuid);

-- Create simple, non-recursive policies
CREATE POLICY "Users can view published documents or own documents" 
ON public.knowledge_documents 
FOR SELECT 
USING (
  is_published = true 
  OR created_by = auth.uid()
);

CREATE POLICY "Users can create their own documents" 
ON public.knowledge_documents 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own documents" 
ON public.knowledge_documents 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own documents" 
ON public.knowledge_documents 
FOR DELETE 
USING (created_by = auth.uid());