-- Update RLS policies for task_documents table to allow all authenticated users
DROP POLICY IF EXISTS "Users can view their own task documents" ON public.task_documents;
DROP POLICY IF EXISTS "Users can create their own task documents" ON public.task_documents;
DROP POLICY IF EXISTS "Users can delete their own task documents" ON public.task_documents;

-- Create new policies that allow all authenticated users to access task documents
CREATE POLICY "All users can view task documents" 
ON public.task_documents 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "All users can create task documents" 
ON public.task_documents 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "All users can delete task documents" 
ON public.task_documents 
FOR DELETE 
TO authenticated
USING (true);

-- Update storage policies for task-documents bucket to allow all authenticated users
DROP POLICY IF EXISTS "Users can view their own task documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own task documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task documents" ON storage.objects;

-- Create new storage policies that allow all authenticated users
CREATE POLICY "All users can view task documents" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'task-documents');

CREATE POLICY "All users can upload task documents" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'task-documents');

CREATE POLICY "All users can delete task documents" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'task-documents');