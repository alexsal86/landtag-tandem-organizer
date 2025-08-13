-- Disable RLS temporarily to drop all policies
ALTER TABLE public.knowledge_documents DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies completely
DROP POLICY IF EXISTS "Users can create their own documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can view accessible documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Document creators and editors can update documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Document creators can delete their documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_select_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_insert_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_update_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_delete_policy" ON public.knowledge_documents;

-- Re-enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "view_documents_policy" 
ON public.knowledge_documents 
FOR SELECT 
USING (
  is_published = true OR created_by = auth.uid()
);

CREATE POLICY "insert_documents_policy" 
ON public.knowledge_documents 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_documents_policy" 
ON public.knowledge_documents 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "delete_documents_policy" 
ON public.knowledge_documents 
FOR DELETE 
USING (created_by = auth.uid());