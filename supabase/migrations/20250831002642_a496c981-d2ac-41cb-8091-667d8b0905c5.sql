-- Fix Storage RLS policies for documents bucket
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents from their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- Create new storage policies that work with letter attachments
CREATE POLICY "Authenticated users can upload letter attachments"
ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view letter attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete letter attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update letter attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);