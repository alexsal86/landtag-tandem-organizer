-- Fix the INSERT policy for task_decisions to allow creation

-- First, check what policy is currently blocking the insert
-- Drop and recreate the policy correctly

DROP POLICY IF EXISTS "Allow authenticated users to create task decisions" ON public.task_decisions;

-- Create a policy that allows users to create decisions where they are the creator
CREATE POLICY "Users can create task decisions" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Also ensure the status field has a default value
ALTER TABLE public.task_decisions 
ALTER COLUMN status SET DEFAULT 'active';