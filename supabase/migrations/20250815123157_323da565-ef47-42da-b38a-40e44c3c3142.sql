-- Drop existing policies
DROP POLICY IF EXISTS "Users can view planning documents for accessible plannings" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload planning documents for editable plannings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete planning documents for editable plannings" ON storage.objects;

-- Create simplified storage policies for planning item documents
CREATE POLICY "Authenticated users can upload to planning-documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'planning-documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view planning-documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'planning-documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete planning-documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'planning-documents'
  AND auth.role() = 'authenticated'
);