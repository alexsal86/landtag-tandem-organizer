-- Erweitere RLS-Policies für appointment_feedback auf Tenant-Basis
-- Alte SELECT-Policies entfernen
DROP POLICY IF EXISTS "Users can view appointment feedback" ON appointment_feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON appointment_feedback;

-- Neue Tenant-basierte SELECT-Policy
CREATE POLICY "Users can view feedback in their tenant"
  ON appointment_feedback FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- INSERT/UPDATE/DELETE bleiben user-basiert (nur eigene Feedbacks bearbeiten)
-- Diese Policies bleiben unverändert