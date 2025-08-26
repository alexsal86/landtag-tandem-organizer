-- Clean up all existing policies and create correct ones
-- First drop all existing policies
DROP POLICY IF EXISTS "Decision creators can manage participants" ON public.task_decision_participants;
DROP POLICY IF EXISTS "Users can view participants of accessible decisions" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_insert_policy" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_select_policy" ON public.task_decision_participants;

DROP POLICY IF EXISTS "Creators can delete their task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Creators can update their task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can create task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can view accessible task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_insert_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_select_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_update_policy" ON public.task_decisions;

-- Now create clean, correct policies for task_decisions
CREATE POLICY "task_decisions_select_clean" 
ON public.task_decisions 
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "task_decisions_insert_clean" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "task_decisions_update_clean" 
ON public.task_decisions 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "task_decisions_delete_clean" 
ON public.task_decisions 
FOR DELETE 
USING (created_by = auth.uid());

-- Create clean policies for task_decision_participants
CREATE POLICY "task_decision_participants_select_clean" 
ON public.task_decision_participants 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "task_decision_participants_insert_clean" 
ON public.task_decision_participants 
FOR INSERT 
WITH CHECK (true); -- Allow all inserts for now, check on application level

CREATE POLICY "task_decision_participants_update_clean" 
ON public.task_decision_participants 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "task_decision_participants_delete_clean" 
ON public.task_decision_participants 
FOR DELETE 
USING (user_id = auth.uid());