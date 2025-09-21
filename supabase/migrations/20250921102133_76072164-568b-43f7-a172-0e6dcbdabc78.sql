-- Create parliament-protocols storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('parliament-protocols', 'parliament-protocols', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for parliament-protocols bucket
DO $$
BEGIN
  -- Policy for authenticated users to insert files in their tenant folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload protocols to their tenant folder'
  ) THEN
    CREATE POLICY "Users can upload protocols to their tenant folder"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'parliament-protocols' 
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = ANY(
        SELECT tenant_id::text 
        FROM user_tenant_memberships 
        WHERE user_id = auth.uid() AND is_active = true
      )
    );
  END IF;

  -- Policy for users to view protocols in their tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view protocols in their tenant'
  ) THEN
    CREATE POLICY "Users can view protocols in their tenant"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'parliament-protocols' 
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = ANY(
        SELECT tenant_id::text 
        FROM user_tenant_memberships 
        WHERE user_id = auth.uid() AND is_active = true
      )
    );
  END IF;

  -- Policy for service role to manage all files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role can manage all parliament protocols'
  ) THEN
    CREATE POLICY "Service role can manage all parliament protocols"
    ON storage.objects
    FOR ALL
    USING (
      bucket_id = 'parliament-protocols' 
      AND auth.jwt() ->> 'role' = 'service_role'
    )
    WITH CHECK (
      bucket_id = 'parliament-protocols' 
      AND auth.jwt() ->> 'role' = 'service_role'
    );
  END IF;
END $$;