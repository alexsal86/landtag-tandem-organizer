-- Add location field to meetings table
ALTER TABLE public.meetings
ADD COLUMN location TEXT;

-- Add RLS policy for file uploads on storage.objects for documents bucket
CREATE POLICY "Users can upload files to documents bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view files in documents bucket  
CREATE POLICY "Users can view files in documents bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update files in documents bucket
CREATE POLICY "Users can update files in documents bucket" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete files in documents bucket
CREATE POLICY "Users can delete files in documents bucket" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1]
);