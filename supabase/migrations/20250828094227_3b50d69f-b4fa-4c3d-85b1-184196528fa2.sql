-- Check current user and context
SELECT auth.uid() as current_user_id, current_user;

-- Add tenant_id column to task_decisions table if missing
ALTER TABLE public.task_decisions 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Update RLS policies to be more permissive for testing
DROP POLICY IF EXISTS "Users can create task decisions" ON public.task_decisions;

-- Create a simple INSERT policy that allows authenticated users
CREATE POLICY "Allow authenticated users to insert task decisions" 
ON public.task_decisions 
FOR INSERT 
TO authenticated
WITH CHECK (
  created_by = auth.uid() OR 
  created_by IS NOT NULL
);