-- Create knowledge document snapshots table for Yjs collaboration persistence
CREATE TABLE IF NOT EXISTS public.knowledge_document_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  yjs_state TEXT NOT NULL, -- Base64 encoded Yjs document state
  document_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  snapshot_type TEXT NOT NULL DEFAULT 'auto' CHECK (snapshot_type IN ('auto', 'manual'))
);

-- Enable RLS
ALTER TABLE public.knowledge_document_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for knowledge document snapshots
CREATE POLICY "Users can view snapshots of accessible documents" 
ON public.knowledge_document_snapshots 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = document_id 
    AND public.can_access_knowledge_document(kd.id, auth.uid())
  )
);

CREATE POLICY "Users can create snapshots for documents they can edit" 
ON public.knowledge_document_snapshots 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = document_id 
    AND public.can_edit_knowledge_document(kd.id, auth.uid())
  ) 
  AND auth.uid() = created_by
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_document_snapshots_document_id_created_at 
ON public.knowledge_document_snapshots(document_id, created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_knowledge_document_snapshots_updated_at
BEFORE UPDATE ON public.knowledge_document_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();