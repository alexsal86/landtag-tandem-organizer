-- Fix order: add columns first, then helper function and RLS

-- 1) Extend employee_settings with admin assignment and scheduling fields
ALTER TABLE public.employee_settings
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workdays boolean[] NOT NULL DEFAULT ARRAY[true,true,true,true,true,false,false],
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Berlin';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_employee_settings_user ON public.employee_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_settings_admin ON public.employee_settings(admin_id);

-- Ensure updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_employee_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_employee_settings_updated_at
    BEFORE UPDATE ON public.employee_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_leave_requests_updated_at'
  ) THEN
    CREATE TRIGGER trg_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 2) Helper function for admin->employee relation (now that admin_id exists)
CREATE OR REPLACE FUNCTION public.is_admin_of(employee uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_settings es
    WHERE es.user_id = employee
      AND es.admin_id = auth.uid()
  );
$$;

-- 3) Update RLS to scope admin access to own employees
ALTER TABLE public.employee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Drop outdated policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employee_settings') THEN
    DROP POLICY IF EXISTS "Admins can delete employee settings" ON public.employee_settings;
    DROP POLICY IF EXISTS "Admins can insert employee settings" ON public.employee_settings;
    DROP POLICY IF EXISTS "Admins can update employee settings" ON public.employee_settings;
    DROP POLICY IF EXISTS "Admins can view all employee settings" ON public.employee_settings;
    DROP POLICY IF EXISTS "Users can view their own employee settings" ON public.employee_settings;
    DROP POLICY IF EXISTS "employee_settings_select_scoped" ON public.employee_settings;
    DROP POLICY IF EXISTS "employee_settings_insert_scoped" ON public.employee_settings;
    DROP POLICY IF EXISTS "employee_settings_update_scoped" ON public.employee_settings;
    DROP POLICY IF EXISTS "employee_settings_delete_scoped" ON public.employee_settings;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leave_requests') THEN
    DROP POLICY IF EXISTS "Admins can delete leave requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Admins can update any leave requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Users can create their own leave requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Users can update their own leave requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "leave_requests_select_scoped" ON public.leave_requests;
    DROP POLICY IF EXISTS "leave_requests_insert_scoped" ON public.leave_requests;
    DROP POLICY IF EXISTS "leave_requests_update_scoped" ON public.leave_requests;
    DROP POLICY IF EXISTS "leave_requests_delete_scoped" ON public.leave_requests;
  END IF;
END$$;

-- New policies: employee_settings
CREATE POLICY "employee_settings_select_scoped" ON public.employee_settings
FOR SELECT USING (
  user_id = auth.uid() OR admin_id = auth.uid()
);

CREATE POLICY "employee_settings_insert_scoped" ON public.employee_settings
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'abgeordneter')
  )
);

CREATE POLICY "employee_settings_update_scoped" ON public.employee_settings
FOR UPDATE USING (
  user_id = auth.uid() OR admin_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid() OR admin_id = auth.uid()
);

CREATE POLICY "employee_settings_delete_scoped" ON public.employee_settings
FOR DELETE USING (
  user_id = auth.uid() OR admin_id = auth.uid()
);

-- New policies: leave_requests using is_admin_of()
CREATE POLICY "leave_requests_select_scoped" ON public.leave_requests
FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin_of(user_id)
);

CREATE POLICY "leave_requests_insert_scoped" ON public.leave_requests
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR public.is_admin_of(user_id)
);

CREATE POLICY "leave_requests_update_scoped" ON public.leave_requests
FOR UPDATE USING (
  user_id = auth.uid() OR public.is_admin_of(user_id)
) WITH CHECK (
  (user_id = auth.uid() AND status = 'pending') OR public.is_admin_of(user_id)
);

CREATE POLICY "leave_requests_delete_scoped" ON public.leave_requests
FOR DELETE USING (
  (user_id = auth.uid() AND status = 'pending') OR public.is_admin_of(user_id)
);
