-- Temporarily disable RLS to test
ALTER TABLE public.task_decisions DISABLE ROW LEVEL SECURITY;

-- Create a simple test policy
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;

-- Create very permissive policies for testing
CREATE POLICY "task_decisions_allow_authenticated" ON public.task_decisions
  FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');