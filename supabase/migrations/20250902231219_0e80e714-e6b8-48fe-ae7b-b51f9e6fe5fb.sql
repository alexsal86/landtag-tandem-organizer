-- Add Yjs state storage to knowledge_documents table
ALTER TABLE public.knowledge_documents 
ADD COLUMN yjs_state BYTEA,
ADD COLUMN document_version INTEGER DEFAULT 1;

-- Create table for Yjs document snapshots and versioning
CREATE TABLE public.knowledge_document_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  yjs_state BYTEA NOT NULL,
  document_version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  snapshot_type TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'manual', 'migration'
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on snapshots table
ALTER TABLE public.knowledge_document_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for snapshots
CREATE POLICY "Users can view snapshots of accessible documents" 
ON public.knowledge_document_snapshots 
FOR SELECT 
USING (
  can_access_knowledge_document(document_id, auth.uid())
);

CREATE POLICY "Users can create snapshots of editable documents" 
ON public.knowledge_document_snapshots 
FOR INSERT 
WITH CHECK (
  can_edit_knowledge_document(document_id, auth.uid()) AND
  created_by = auth.uid()
);

-- Create index for better performance
CREATE INDEX idx_knowledge_document_snapshots_document_id ON public.knowledge_document_snapshots(document_id);
CREATE INDEX idx_knowledge_document_snapshots_version ON public.knowledge_document_snapshots(document_id, document_version);

-- Create function to create automatic snapshots
CREATE OR REPLACE FUNCTION public.create_knowledge_document_snapshot(
  _document_id UUID,
  _yjs_state BYTEA,
  _snapshot_type TEXT DEFAULT 'auto'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  snapshot_id UUID;
  current_version INTEGER;
BEGIN
  -- Get current document version
  SELECT document_version INTO current_version
  FROM public.knowledge_documents
  WHERE id = _document_id;
  
  -- Create snapshot
  INSERT INTO public.knowledge_document_snapshots (
    document_id, yjs_state, document_version, created_by, snapshot_type
  ) VALUES (
    _document_id, _yjs_state, current_version, auth.uid(), _snapshot_type
  ) RETURNING id INTO snapshot_id;
  
  RETURN snapshot_id;
END;
$$;