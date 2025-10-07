-- Create calendar sync settings table
CREATE TABLE IF NOT EXISTS public.calendar_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sync_interval_hours INTEGER NOT NULL DEFAULT 24,
  sync_time TIME NOT NULL DEFAULT '06:00:00',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.calendar_sync_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's sync settings"
  ON public.calendar_sync_settings FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenant_memberships WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Admins can update their tenant's sync settings"
  ON public.calendar_sync_settings FOR UPDATE
  USING (
    tenant_id IN (
      SELECT utm.tenant_id 
      FROM public.user_tenant_memberships utm
      JOIN public.user_roles ur ON ur.user_id = utm.user_id
      WHERE utm.user_id = auth.uid() 
        AND utm.is_active = true
        AND ur.role IN ('abgeordneter', 'bueroleitung')
    )
  );

CREATE POLICY "Admins can insert their tenant's sync settings"
  ON public.calendar_sync_settings FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT utm.tenant_id 
      FROM public.user_tenant_memberships utm
      JOIN public.user_roles ur ON ur.user_id = utm.user_id
      WHERE utm.user_id = auth.uid() 
        AND utm.is_active = true
        AND ur.role IN ('abgeordneter', 'bueroleitung')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_calendar_sync_settings_updated_at
  BEFORE UPDATE ON public.calendar_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create default settings for existing tenants
INSERT INTO public.calendar_sync_settings (tenant_id, sync_interval_hours, sync_time, is_enabled)
SELECT id, 24, '06:00:00', true
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Enable required extensions for cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job for hourly sync check
SELECT cron.schedule(
  'auto-sync-external-calendars',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://wawofclbehbkebjivdte.supabase.co/functions/v1/auto-sync-calendars',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);