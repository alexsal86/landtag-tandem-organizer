-- =====================================================
-- SECURITY HARDENING MIGRATION - Part 1: RLS (Fixed)
-- =====================================================

-- 1. Enable RLS on widget_rate_limits table
ALTER TABLE public.widget_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create restrictive policy for widget_rate_limits
CREATE POLICY "Service role can manage rate limits"
  ON public.widget_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read rate limits"
  ON public.widget_rate_limits
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix overly-permissive RLS policies

-- 2a. Fix task_documents policies
DROP POLICY IF EXISTS "All users can create task documents" ON public.task_documents;
DROP POLICY IF EXISTS "All users can delete task documents" ON public.task_documents;

CREATE POLICY "Authenticated users can create task documents for accessible tasks"
  ON public.task_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
      AND (
        t.user_id = auth.uid()
        OR t.assigned_to = auth.uid()::text
        OR t.tenant_id IN (
          SELECT utm.tenant_id FROM public.user_tenant_memberships utm
          WHERE utm.user_id = auth.uid() AND utm.is_active = true
        )
      )
    )
  );

CREATE POLICY "Users can delete their own task documents"
  ON public.task_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
      AND (
        t.user_id = auth.uid()
        OR t.assigned_to = auth.uid()::text
      )
    )
  );

-- 2b. Fix employee_settings_history policies (no tenant_id - use changed_by)
DROP POLICY IF EXISTS "System can insert history" ON public.employee_settings_history;
DROP POLICY IF EXISTS "System can update history" ON public.employee_settings_history;

CREATE POLICY "Authenticated users can insert history"
  ON public.employee_settings_history
  FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Authenticated users can update own history"
  ON public.employee_settings_history
  FOR UPDATE
  TO authenticated
  USING (changed_by = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Service role can manage employee history"
  ON public.employee_settings_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2c. Fix notifications policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "System can create notifications for tenant members"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_memberships utm
      WHERE utm.user_id = auth.uid()
      AND utm.tenant_id = notifications.tenant_id
      AND utm.is_active = true
    )
  );

CREATE POLICY "Service role can create notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2d. Fix time_entry_history policy
DROP POLICY IF EXISTS "System can insert time entry history" ON public.time_entry_history;

CREATE POLICY "Authenticated users can insert own time entry history"
  ON public.time_entry_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can insert time entry history"
  ON public.time_entry_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);