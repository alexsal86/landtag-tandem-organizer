-- Create table for decision archive settings
CREATE TABLE public.decision_archive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auto_archive_on_completion BOOLEAN DEFAULT true,
  auto_archive_days INTEGER,
  auto_delete_after_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT decision_archive_settings_unique_user_tenant UNIQUE (user_id, tenant_id)
);

-- Enable Row Level Security
ALTER TABLE public.decision_archive_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for decision_archive_settings
CREATE POLICY "Users can view own archive settings"
ON public.decision_archive_settings
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own archive settings"
ON public.decision_archive_settings
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own archive settings"
ON public.decision_archive_settings
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own archive settings"
ON public.decision_archive_settings
FOR DELETE
USING (user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_decision_archive_settings_updated_at
BEFORE UPDATE ON public.decision_archive_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new RLS policy for employee_settings to allow admins to view all tenant employees
CREATE POLICY "Admins can view all tenant employee settings"
ON public.employee_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_tenant_memberships utm1
    JOIN user_tenant_memberships utm2 ON utm1.tenant_id = utm2.tenant_id
    JOIN user_roles ur ON ur.user_id = utm2.user_id
    WHERE utm1.user_id = employee_settings.user_id
      AND utm2.user_id = auth.uid()
      AND utm2.is_active = true
      AND ur.role IN ('abgeordneter', 'bueroleitung')
  )
);

-- Add similar policy for time_entries to allow admins to view all tenant time entries
CREATE POLICY "Admins can view all tenant time entries"
ON public.time_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_tenant_memberships utm1
    JOIN user_tenant_memberships utm2 ON utm1.tenant_id = utm2.tenant_id
    JOIN user_roles ur ON ur.user_id = utm2.user_id
    WHERE utm1.user_id = time_entries.user_id
      AND utm2.user_id = auth.uid()
      AND utm2.is_active = true
      AND ur.role IN ('abgeordneter', 'bueroleitung')
  )
);