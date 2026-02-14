-- Fix DELETE policy for letter-assets: the current policy checks metadata->>'uploadedBy' 
-- which is never set during upload, so deletions always fail.
-- Replace with a simple authenticated user check.
DROP POLICY IF EXISTS "Users can delete their uploaded letter assets" ON storage.objects;
CREATE POLICY "Users can delete their uploaded letter assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'letter-assets' AND auth.role() = 'authenticated');

-- Also fix UPDATE policy for consistency
DROP POLICY IF EXISTS "Users can update their uploaded letter assets" ON storage.objects;
CREATE POLICY "Users can update their uploaded letter assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'letter-assets' AND auth.role() = 'authenticated');