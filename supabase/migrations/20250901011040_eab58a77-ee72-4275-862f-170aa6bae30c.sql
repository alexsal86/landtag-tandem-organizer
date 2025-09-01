-- Create RLS policies for documents storage bucket if they don't exist

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update documents" ON storage.objects;

-- Create policy for users to read their own documents  
CREATE POLICY "Users can view their own documents" 
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

-- Create policy for service role to upload documents
CREATE POLICY "Service role can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text OR auth.role() = 'authenticated')
);

-- Create policy for service role to update documents  
CREATE POLICY "Service role can update documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text OR auth.role() = 'authenticated')
);