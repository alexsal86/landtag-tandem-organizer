-- Clean up duplicate policies on task_decision_participants
DROP POLICY IF EXISTS "participants_can_view_own_and_creators_can_view_all" ON public.task_decision_participants;