-- Drop alte, unsichere Storage-Policies
DROP POLICY IF EXISTS "Authenticated users can upload to planning-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view planning-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete planning-documents" ON storage.objects;

-- Neue, sichere Policies mit Tenant-Isolation
CREATE POLICY "Users can upload planning documents in their tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'planning-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can view planning documents in their tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'planning-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can delete planning documents in their tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'planning-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_tenant_memberships 
    WHERE user_id = auth.uid() AND is_active = true
  )
);