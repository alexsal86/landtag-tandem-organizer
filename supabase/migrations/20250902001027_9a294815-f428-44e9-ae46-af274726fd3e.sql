-- Fix storage policies for avatars bucket
-- Create storage policies for logo/avatar uploads

-- Create policy for public access to avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

-- Create policy for authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Create policy for users to update their uploads
CREATE POLICY "Authenticated users can update avatars" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Create policy for users to delete their uploads
CREATE POLICY "Authenticated users can delete avatars" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);