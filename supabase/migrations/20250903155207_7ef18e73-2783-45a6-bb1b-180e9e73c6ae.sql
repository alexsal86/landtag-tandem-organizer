-- Fix the knowledge_document_snapshots table and create proper function
-- Just keep it as TEXT for now since BYTEA conversion failed
CREATE OR REPLACE FUNCTION public.create_knowledge_document_snapshot(
  _document_id UUID, 
  _yjs_state TEXT, 
  _snapshot_type TEXT DEFAULT 'auto'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  snapshot_id UUID;
  current_version INTEGER;
BEGIN
  -- Check if user can edit the document
  IF NOT public.can_edit_knowledge_document(_document_id, auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: Cannot edit this document';
  END IF;
  
  -- Get current document version
  SELECT document_version INTO current_version
  FROM public.knowledge_documents
  WHERE id = _document_id;
  
  -- If no version found, set to 1
  current_version := COALESCE(current_version, 1);
  
  -- Create snapshot 
  INSERT INTO public.knowledge_document_snapshots (
    document_id, yjs_state, document_version, created_by, snapshot_type
  ) VALUES (
    _document_id, 
    _yjs_state, 
    current_version, 
    auth.uid(), 
    _snapshot_type
  ) RETURNING id INTO snapshot_id;
  
  RETURN snapshot_id;
END;
$$;