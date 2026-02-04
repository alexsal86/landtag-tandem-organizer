-- Add SELECT policy for avatars bucket to allow public reading of uploaded avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');