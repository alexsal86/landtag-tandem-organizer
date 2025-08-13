-- Create knowledge base documents table
CREATE TABLE public.knowledge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_published BOOLEAN DEFAULT false
);

-- Create document permissions table
CREATE TABLE public.knowledge_document_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit')),
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id, permission_type)
);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_document_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_documents
CREATE POLICY "Users can view documents they have permission for"
ON public.knowledge_documents FOR SELECT
USING (
  created_by = auth.uid() OR 
  is_published = true OR
  EXISTS (
    SELECT 1 FROM public.knowledge_document_permissions kdp 
    WHERE kdp.document_id = id AND kdp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own documents"
ON public.knowledge_documents FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Document creators and editors can update documents"
ON public.knowledge_documents FOR UPDATE
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.knowledge_document_permissions kdp 
    WHERE kdp.document_id = id AND kdp.user_id = auth.uid() AND kdp.permission_type = 'edit'
  )
);

CREATE POLICY "Document creators can delete their documents"
ON public.knowledge_documents FOR DELETE
USING (created_by = auth.uid());

-- RLS Policies for knowledge_document_permissions
CREATE POLICY "Users can view permissions for documents they access"
ON public.knowledge_document_permissions FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = document_id AND kd.created_by = auth.uid()
  )
);

CREATE POLICY "Document creators can manage permissions"
ON public.knowledge_document_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = document_id AND kd.created_by = auth.uid()
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for collaborative editing
ALTER TABLE public.knowledge_documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_documents;