-- Create planning-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('planning-documents', 'planning-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for planning-documents bucket
CREATE POLICY "Users can upload planning documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'planning-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own planning documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'planning-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own planning documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'planning-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Grant collaborators access to planning documents
CREATE POLICY "Collaborators can view planning documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'planning-documents'
  AND EXISTS (
    SELECT 1 FROM planning_item_documents pid
    JOIN event_planning_checklist_items ci ON pid.planning_item_id = ci.id
    JOIN event_planning_collaborators epc ON ci.event_planning_id = epc.event_planning_id
    WHERE pid.file_path = name
    AND epc.user_id = auth.uid()
  )
);