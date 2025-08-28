-- Check current policies on task_decisions
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'task_decisions';

-- Drop any conflicting policies and create a simple one
DROP POLICY IF EXISTS "Allow authenticated users to insert task decisions" ON task_decisions;
DROP POLICY IF EXISTS "Users can create their own task decisions" ON task_decisions;

-- Create a simple policy that allows authenticated users to insert
CREATE POLICY "authenticated_users_can_insert_task_decisions" ON task_decisions
  FOR INSERT WITH CHECK (auth.uid() = created_by);