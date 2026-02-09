
-- Fix: Remove redundant UPDATE policies on task_decisions that cause WITH CHECK conflicts
DROP POLICY IF EXISTS "Users can update their own decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_update_policy" ON public.task_decisions;

-- Fix: Remove redundant SELECT policies
DROP POLICY IF EXISTS "task_decisions_select_policy" ON public.task_decisions;

-- Fix: Remove redundant DELETE policies
DROP POLICY IF EXISTS "task_decisions_delete_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can delete their own decisions" ON public.task_decisions;

-- Fix: Extend CHECK constraint to include 'open' status
ALTER TABLE public.task_decisions DROP CONSTRAINT IF EXISTS task_decisions_status_check;
ALTER TABLE public.task_decisions ADD CONSTRAINT task_decisions_status_check 
  CHECK (status = ANY (ARRAY['active'::text, 'open'::text, 'archived'::text]));
