-- Drop and recreate RLS policies for documents bucket with correct configurations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update documents" ON storage.objects;

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('documents', 'documents', false, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Policy for authenticated users to read documents in their tenant
CREATE POLICY "Users can view documents in their tenant"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (
    -- Allow users to view documents they uploaded
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow service role to access all documents
    auth.jwt() ->> 'role' = 'service_role' OR
    -- Allow users to access archived letters (public archived_letters folder)
    (storage.foldername(name))[1] = 'archived_letters'
  )
);

-- Policy for authenticated users to upload documents
CREATE POLICY "Users can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (
    -- Allow users to upload to their own folder
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow service role to upload anywhere
    auth.jwt() ->> 'role' = 'service_role' OR
    -- Allow uploading to archived_letters folder
    (storage.foldername(name))[1] = 'archived_letters'
  )
);

-- Policy for authenticated users to update documents  
CREATE POLICY "Users can update documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (
    -- Allow users to update documents in their folder
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow service role to update any document
    auth.jwt() ->> 'role' = 'service_role' OR
    -- Allow updating archived letters
    (storage.foldername(name))[1] = 'archived_letters'
  )
);

-- Policy for authenticated users to delete documents
CREATE POLICY "Users can delete documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (
    -- Allow users to delete documents in their folder
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow service role to delete any document
    auth.jwt() ->> 'role' = 'service_role'
  )
);