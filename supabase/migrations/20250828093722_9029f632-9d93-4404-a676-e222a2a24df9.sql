-- Debug the RLS issue with task_decisions
-- First, let's check if RLS is enabled and debug the auth
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'task_decisions';

-- Let's see if there are any issues with auth.uid() function
-- Drop all existing policies and recreate them more explicitly
DROP POLICY IF EXISTS "Users can create task decisions" ON public.task_decisions;

-- Create a more explicit policy that ensures proper auth checking
CREATE POLICY "Allow authenticated users to create decisions" 
ON public.task_decisions 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);

-- Let's also check if the column exists and has proper type
ALTER TABLE public.task_decisions 
ALTER COLUMN created_by SET NOT NULL;