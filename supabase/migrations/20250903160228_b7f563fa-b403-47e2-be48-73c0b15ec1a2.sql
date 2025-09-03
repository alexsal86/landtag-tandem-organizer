-- Check if knowledge_document_snapshots table exists, if not create it
CREATE TABLE IF NOT EXISTS public.knowledge_document_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  yjs_state TEXT NOT NULL,
  document_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  snapshot_type TEXT NOT NULL DEFAULT 'auto'
);

-- Enable RLS
ALTER TABLE public.knowledge_document_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Users can create snapshots for accessible documents" 
  ON public.knowledge_document_snapshots 
  FOR INSERT 
  WITH CHECK (can_edit_knowledge_document(document_id, auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can view snapshots for accessible documents" 
  ON public.knowledge_document_snapshots 
  FOR SELECT 
  USING (can_access_knowledge_document(document_id, auth.uid()));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_document_snapshots_document_id 
  ON public.knowledge_document_snapshots(document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_snapshots_created_at 
  ON public.knowledge_document_snapshots(created_at DESC);