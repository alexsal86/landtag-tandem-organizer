-- Drop all existing policies and recreate them properly
DROP POLICY IF EXISTS "Users can create task decisions for any task" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can view accessible task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can update their own task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can delete their own task decisions" ON public.task_decisions;

-- Simple policy that allows any authenticated user to insert
CREATE POLICY "Allow authenticated users to create task decisions" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (true);

-- Allow users to view decisions they created or participate in
CREATE POLICY "Users can view accessible task decisions" 
ON public.task_decisions 
FOR SELECT 
USING (user_can_access_task_decision(id, auth.uid()));

-- Allow users to update their own decisions
CREATE POLICY "Users can update their own task decisions" 
ON public.task_decisions 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own decisions
CREATE POLICY "Users can delete their own task decisions" 
ON public.task_decisions 
FOR DELETE 
USING (created_by = auth.uid());