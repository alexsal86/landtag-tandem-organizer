
-- ============================================
-- 1. Fix RLS policies on employee_meetings
-- ============================================

-- Drop the restrictive policy that only allows viewing completed meetings
DROP POLICY IF EXISTS "Employees can view their own completed meetings" ON public.employee_meetings;

-- Employees can view ALL their own meetings (any status)
CREATE POLICY "Employees can view their own meetings"
ON public.employee_meetings
FOR SELECT
USING (employee_id = auth.uid());

-- Employees can update their own meeting data (preparation, protocol)
CREATE POLICY "Employees can update their own meeting data"
ON public.employee_meetings
FOR UPDATE
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

-- Conductors can fully manage meetings they conduct
CREATE POLICY "Conductors can manage their meetings"
ON public.employee_meetings
FOR ALL
USING (conducted_by = auth.uid())
WITH CHECK (conducted_by = auth.uid());

-- ============================================
-- 2. Add task_id column to employee_meeting_action_items
-- ============================================

ALTER TABLE public.employee_meeting_action_items
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add SELECT policy for action items so employees can also see them
-- (already exists: "Users can view their meeting action items")

-- Allow employees to INSERT action items for their own meetings
CREATE POLICY "Employees can insert action items for their meetings"
ON public.employee_meeting_action_items
FOR INSERT
WITH CHECK (
  (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
  AND EXISTS (
    SELECT 1 FROM employee_meetings em
    WHERE em.id = employee_meeting_action_items.meeting_id
    AND (em.employee_id = auth.uid() OR em.conducted_by = auth.uid())
  )
);
