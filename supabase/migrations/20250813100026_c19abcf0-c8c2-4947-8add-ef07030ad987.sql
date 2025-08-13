-- Fix the infinite recursion issue in knowledge_documents policies
-- Drop the problematic policies first
DROP POLICY IF EXISTS "Users can view documents they have permission for" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Document creators and editors can update documents" ON public.knowledge_documents;

-- Create a security definer function to check permissions
CREATE OR REPLACE FUNCTION public.can_access_knowledge_document(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is creator
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = _document_id AND kd.created_by = _user_id
  ) OR EXISTS (
    -- Check if document is published
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = _document_id AND kd.is_published = true
  ) OR EXISTS (
    -- Check if user has explicit permission
    SELECT 1 FROM public.knowledge_document_permissions kdp 
    WHERE kdp.document_id = _document_id AND kdp.user_id = _user_id
  );
$$;

-- Create a security definer function to check edit permissions
CREATE OR REPLACE FUNCTION public.can_edit_knowledge_document(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is creator
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = _document_id AND kd.created_by = _user_id
  ) OR EXISTS (
    -- Check if user has explicit edit permission
    SELECT 1 FROM public.knowledge_document_permissions kdp 
    WHERE kdp.document_id = _document_id AND kdp.user_id = _user_id AND kdp.permission_type = 'edit'
  );
$$;

-- Recreate the policies using the security definer functions
CREATE POLICY "Users can view accessible documents"
ON public.knowledge_documents FOR SELECT
USING (
  created_by = auth.uid() OR 
  is_published = true OR
  EXISTS (
    SELECT 1 FROM public.knowledge_document_permissions kdp 
    WHERE kdp.document_id = id AND kdp.user_id = auth.uid()
  )
);

CREATE POLICY "Document creators and editors can update documents"
ON public.knowledge_documents FOR UPDATE
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.knowledge_document_permissions kdp 
    WHERE kdp.document_id = id AND kdp.user_id = auth.uid() AND kdp.permission_type = 'edit'
  )
);