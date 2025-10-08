-- Extend employee_meetings table with preparation fields
ALTER TABLE public.employee_meetings 
ADD COLUMN employee_preparation JSONB DEFAULT '{}'::jsonb,
ADD COLUMN supervisor_preparation JSONB DEFAULT '{}'::jsonb,
ADD COLUMN shared_during_meeting BOOLEAN DEFAULT false;

-- Extend employee_meeting_requests table with decline fields
ALTER TABLE public.employee_meeting_requests
ADD COLUMN declined_reason TEXT,
ADD COLUMN declined_at TIMESTAMPTZ,
ADD COLUMN declined_by UUID REFERENCES auth.users(id);

-- Create employee_meeting_action_items table
CREATE TABLE public.employee_meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.employee_meetings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('employee', 'supervisor', 'both')),
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at trigger for action items
CREATE TRIGGER update_employee_meeting_action_items_updated_at
BEFORE UPDATE ON public.employee_meeting_action_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on action items table
ALTER TABLE public.employee_meeting_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view action items from meetings they participated in
CREATE POLICY "Users can view their meeting action items"
ON public.employee_meeting_action_items
FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND (
    EXISTS (
      SELECT 1 FROM public.employee_meetings em
      WHERE em.id = employee_meeting_action_items.meeting_id
      AND (em.employee_id = auth.uid() OR em.conducted_by = auth.uid())
    )
  )
);

-- RLS Policy: Employees can update status and notes on items assigned to them
CREATE POLICY "Employees can update their assigned action items"
ON public.employee_meeting_action_items
FOR UPDATE
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND assigned_to = auth.uid()
)
WITH CHECK (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND assigned_to = auth.uid()
);

-- RLS Policy: Supervisors can manage all action items from their meetings
CREATE POLICY "Supervisors can manage action items from their meetings"
ON public.employee_meeting_action_items
FOR ALL
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.employee_meetings em
    WHERE em.id = employee_meeting_action_items.meeting_id
    AND em.conducted_by = auth.uid()
  )
)
WITH CHECK (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.employee_meetings em
    WHERE em.id = employee_meeting_action_items.meeting_id
    AND em.conducted_by = auth.uid()
  )
);

-- RLS Policy: Tenant admins have full access
CREATE POLICY "Tenant admins can manage all action items"
ON public.employee_meeting_action_items
FOR ALL
USING (
  is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- Add comment
COMMENT ON TABLE public.employee_meeting_action_items IS 'Tracks action items and follow-ups from employee meetings';