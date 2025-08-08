-- Employee Management Schema: employee_settings and leave_requests with RLS
-- Create enums for leave types and status if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
    CREATE TYPE public.leave_type AS ENUM ('vacation','sick','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
    CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected');
  END IF;
END$$;

-- Timestamp trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Employee settings: one row per employee, assigned to an admin
CREATE TABLE IF NOT EXISTS public.employee_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hours_per_week NUMERIC(5,2) NOT NULL DEFAULT 40,
  -- Workdays array: [Mon..Sun]
  workdays BOOLEAN[] NOT NULL DEFAULT ARRAY[true,true,true,true,true,false,false],
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_settings_employee UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_settings_employee ON public.employee_settings(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_settings_admin ON public.employee_settings(admin_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_employee_settings_updated_at ON public.employee_settings;
CREATE TRIGGER trg_employee_settings_updated_at
BEFORE UPDATE ON public.employee_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leave requests for employees
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.leave_type NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date ON public.leave_requests(start_date, end_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.employee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Helper predicate: checks if current user is admin of the employee
CREATE OR REPLACE FUNCTION public.is_admin_of(employee UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_settings es
    WHERE es.employee_id = employee
      AND es.admin_id = auth.uid()
  );
$$;

-- Policies for employee_settings
-- Select: employee sees own row; admin sees rows for their employees
DROP POLICY IF EXISTS "employee_settings_select" ON public.employee_settings;
CREATE POLICY "employee_settings_select" ON public.employee_settings
FOR SELECT USING (
  employee_id = auth.uid() OR admin_id = auth.uid()
);

-- Insert: employee can create their own row; admin can create for their employees
DROP POLICY IF EXISTS "employee_settings_insert" ON public.employee_settings;
CREATE POLICY "employee_settings_insert" ON public.employee_settings
FOR INSERT WITH CHECK (
  employee_id = auth.uid() OR (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'abgeordneter')
  )
);

-- Update: employee can update own; admin can update for their employees
DROP POLICY IF EXISTS "employee_settings_update" ON public.employee_settings;
CREATE POLICY "employee_settings_update" ON public.employee_settings
FOR UPDATE USING (
  employee_id = auth.uid() OR admin_id = auth.uid()
) WITH CHECK (
  employee_id = auth.uid() OR admin_id = auth.uid()
);

-- Delete: admin of that employee or the employee themself
DROP POLICY IF EXISTS "employee_settings_delete" ON public.employee_settings;
CREATE POLICY "employee_settings_delete" ON public.employee_settings
FOR DELETE USING (
  employee_id = auth.uid() OR admin_id = auth.uid()
);

-- Policies for leave_requests
-- Select: employee sees own requests; admin of that employee sees them too
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
FOR SELECT USING (
  employee_id = auth.uid() OR public.is_admin_of(employee_id)
);

-- Insert: employee can create their own; admin can create for their employees
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
FOR INSERT WITH CHECK (
  employee_id = auth.uid() OR public.is_admin_of(employee_id)
);

-- Update: employee can update only if it's theirs and keep status pending; admin can update any of their employees
DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
FOR UPDATE USING (
  employee_id = auth.uid() OR public.is_admin_of(employee_id)
) WITH CHECK (
  (employee_id = auth.uid() AND status = 'pending') OR public.is_admin_of(employee_id)
);

-- Delete: employee can delete their own pending; admin can delete any of their employees' requests
DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
FOR DELETE USING (
  (employee_id = auth.uid() AND status = 'pending') OR public.is_admin_of(employee_id)
);
