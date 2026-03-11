
-- 1. Add deputy_user_id to leave_requests
ALTER TABLE public.leave_requests ADD COLUMN deputy_user_id uuid REFERENCES auth.users(id);

-- 2. Create vacation checklist templates table (admin-configurable)
CREATE TABLE public.vacation_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  reminder_after boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vacation_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view active checklist templates"
  ON public.vacation_checklist_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND tenant_id = vacation_checklist_templates.tenant_id AND is_active = true
    )
  );

CREATE POLICY "Admins can manage checklist templates"
  ON public.vacation_checklist_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND tenant_id = vacation_checklist_templates.tenant_id AND is_active = true AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND tenant_id = vacation_checklist_templates.tenant_id AND is_active = true AND role = 'admin'
    )
  );

-- 3. Create vacation checklist responses table
CREATE TABLE public.vacation_checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.vacation_checklist_templates(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(leave_request_id, checklist_item_id)
);

ALTER TABLE public.vacation_checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklist responses"
  ON public.vacation_checklist_responses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own checklist responses"
  ON public.vacation_checklist_responses FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Create active_deputyships view for quick lookup
CREATE OR REPLACE VIEW public.active_deputyships AS
SELECT
  lr.deputy_user_id,
  lr.user_id AS absent_user_id,
  lr.type AS leave_type,
  lr.start_date,
  lr.end_date,
  lr.id AS leave_request_id
FROM public.leave_requests lr
WHERE lr.deputy_user_id IS NOT NULL
  AND lr.status = 'approved'
  AND lr.start_date <= CURRENT_DATE
  AND lr.end_date >= CURRENT_DATE;

-- 5. Security definer function to check if user is currently a deputy for another user
CREATE OR REPLACE FUNCTION public.is_deputy_for(_deputy_id uuid, _absent_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE deputy_user_id = _deputy_id
      AND user_id = _absent_user_id
      AND status = 'approved'
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
  )
$$;

-- 6. Update timestamp trigger for checklist templates
CREATE TRIGGER update_vacation_checklist_templates_updated_at
  BEFORE UPDATE ON public.vacation_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
