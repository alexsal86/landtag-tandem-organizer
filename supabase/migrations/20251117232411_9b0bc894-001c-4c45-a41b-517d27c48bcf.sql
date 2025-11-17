-- Create audit_log_entries table
CREATE TABLE IF NOT EXISTS public.audit_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  payload JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_ip_address ON public.audit_log_entries(ip_address);

-- Enable RLS
ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin_for_audit_logs(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'abgeordneter'
  )
$$;

-- RLS Policy: Only admins (abgeordneter role) can view audit logs
CREATE POLICY "Admin users can view audit logs"
ON public.audit_log_entries
FOR SELECT
TO authenticated
USING (public.is_admin_for_audit_logs(auth.uid()));

-- No INSERT, UPDATE, DELETE policies - audit logs should only be created by system/triggers