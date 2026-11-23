CREATE TABLE public.appointment_change_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  appointment_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.appointment_change_alerts TO authenticated;
GRANT ALL ON public.appointment_change_alerts TO service_role;
ALTER TABLE public.appointment_change_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office members read alerts" ON public.appointment_change_alerts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = appointment_change_alerts.tenant_id AND m.is_active));
CREATE POLICY "office members create alerts" ON public.appointment_change_alerts FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = appointment_change_alerts.tenant_id AND m.is_active));
CREATE POLICY "office members acknowledge alerts" ON public.appointment_change_alerts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = appointment_change_alerts.tenant_id AND m.is_active))
WITH CHECK (acknowledged_by = auth.uid());
CREATE INDEX ON public.appointment_change_alerts (tenant_id, acknowledged_at);