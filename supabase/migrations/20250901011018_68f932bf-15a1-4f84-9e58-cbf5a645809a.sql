-- Ensure proper RLS policies for documents storage bucket

-- Policy to allow users to view their own documents
INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', 'test.txt')
ON CONFLICT DO NOTHING;

-- Create policy for users to read their own documents  
CREATE POLICY IF NOT EXISTS "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.file_path = storage.objects.name 
    AND d.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
);

-- Create policy for edge functions to upload documents
CREATE POLICY IF NOT EXISTS "Service role can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text OR auth.role() = 'authenticated')
);

-- Create policy for edge functions to update documents  
CREATE POLICY IF NOT EXISTS "Service role can update documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text OR auth.role() = 'authenticated')
);

-- Remove test object
DELETE FROM storage.objects WHERE bucket_id = 'documents' AND name = 'test.txt';