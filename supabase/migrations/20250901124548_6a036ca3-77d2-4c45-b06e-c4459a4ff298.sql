-- Create storage bucket for letter assets
INSERT INTO storage.buckets (id, name, public) VALUES ('letter-assets', 'letter-assets', true);

-- Create RLS policies for letter assets
CREATE POLICY "Users can upload letter assets to their tenant folder" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'letter-assets' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1]::uuid = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can view letter assets from their tenant" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'letter-assets' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1]::uuid = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can update letter assets in their tenant" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'letter-assets' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1]::uuid = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can delete letter assets from their tenant" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'letter-assets' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1]::uuid = ANY(get_user_tenant_ids(auth.uid()))
);