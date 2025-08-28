-- Fix the critical RLS policy issues for task_decisions
-- There appears to be confusion with policy names

-- First, let's see the current policies
SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'task_decisions';

-- Drop any existing problematic policies
DROP POLICY IF EXISTS "Users can create task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Allow authenticated users to create decisions" ON public.task_decisions;

-- Create proper INSERT policy for task_decisions
CREATE POLICY "Users can create task decisions" 
ON public.task_decisions 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by
);

-- Also add missing policies for other operations since linter found no policies
CREATE POLICY "Users can view accessible task decisions" 
ON public.task_decisions 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM task_decision_participants tdp 
      WHERE tdp.decision_id = task_decisions.id 
      AND tdp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their own task decisions" 
ON public.task_decisions 
FOR UPDATE 
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own task decisions" 
ON public.task_decisions 
FOR DELETE 
TO authenticated
USING (auth.uid() = created_by);