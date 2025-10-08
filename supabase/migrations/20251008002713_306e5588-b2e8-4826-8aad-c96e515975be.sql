-- Add columns to employee_settings
ALTER TABLE public.employee_settings
ADD COLUMN IF NOT EXISTS last_meeting_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meeting_interval_months INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_meeting_reminder_days INTEGER DEFAULT 14;

-- Create employee_meetings table
CREATE TABLE IF NOT EXISTS public.employee_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conducted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_date TIMESTAMPTZ NOT NULL,
  next_meeting_due TIMESTAMPTZ,
  meeting_type TEXT NOT NULL DEFAULT 'regular' CHECK (meeting_type IN ('regular', 'probation', 'development', 'conflict', 'performance')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  protocol JSONB DEFAULT '{}',
  employee_notes TEXT,
  supervisor_notes TEXT,
  action_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create employee_meeting_requests table
CREATE TABLE IF NOT EXISTS public.employee_meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'declined')),
  scheduled_meeting_id UUID REFERENCES public.employee_meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_meeting_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_meetings_employee ON public.employee_meetings(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_meetings_tenant ON public.employee_meetings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_meetings_date ON public.employee_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_employee_meeting_requests_employee ON public.employee_meeting_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_meeting_requests_tenant ON public.employee_meeting_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_meeting_requests_status ON public.employee_meeting_requests(status);

-- RLS Policies for employee_meetings
-- Employees can view their completed meetings (read-only)
CREATE POLICY "Employees can view their own completed meetings"
ON public.employee_meetings
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid() 
  AND status = 'completed'
);

-- Supervisors can manage meetings for their employees
CREATE POLICY "Supervisors can manage meetings for their employees"
ON public.employee_meetings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_settings es
    WHERE es.user_id = employee_meetings.employee_id
    AND es.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_settings es
    WHERE es.user_id = employee_meetings.employee_id
    AND es.admin_id = auth.uid()
  )
);

-- Tenant admins have full access
CREATE POLICY "Tenant admins can manage all meetings"
ON public.employee_meetings
FOR ALL
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- RLS Policies for employee_meeting_requests
-- Employees can create and view their own requests
CREATE POLICY "Employees can manage their own meeting requests"
ON public.employee_meeting_requests
FOR ALL
TO authenticated
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

-- Supervisors can view and manage requests from their employees
CREATE POLICY "Supervisors can manage requests from their employees"
ON public.employee_meeting_requests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_settings es
    WHERE es.user_id = employee_meeting_requests.employee_id
    AND es.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_settings es
    WHERE es.user_id = employee_meeting_requests.employee_id
    AND es.admin_id = auth.uid()
  )
);

-- Tenant admins have full access
CREATE POLICY "Tenant admins can manage all meeting requests"
ON public.employee_meeting_requests
FOR ALL
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_employee_meetings_updated_at
BEFORE UPDATE ON public.employee_meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_meeting_requests_updated_at
BEFORE UPDATE ON public.employee_meeting_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert notification types (with label column)
INSERT INTO public.notification_types (name, label, description, is_active)
VALUES 
  ('employee_meeting_due', 'Gespräch fällig', 'Mitarbeitergespräch steht an', true),
  ('employee_meeting_overdue', 'Gespräch überfällig', 'Mitarbeitergespräch überfällig', true),
  ('employee_meeting_requested', 'Gesprächswunsch', 'Mitarbeiter wünscht Gespräch', true),
  ('employee_meeting_scheduled', 'Gespräch terminiert', 'Mitarbeitergespräch terminiert', true),
  ('employee_meeting_reminder', 'Gesprächserinnerung', 'Erinnerung an Mitarbeitergespräch', true)
ON CONFLICT (name) DO NOTHING;