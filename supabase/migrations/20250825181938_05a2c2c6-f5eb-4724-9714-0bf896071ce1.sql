-- Fix data migration for remaining NULL tenant_id values

DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants WHERE name = 'Standard Büro' LIMIT 1;
  
  -- Update any remaining NULL tenant_id values
  UPDATE public.profiles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.contacts SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.tasks SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.appointments SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.documents SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.meetings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.team_dashboards SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.messages SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.user_status SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.notifications SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.knowledge_documents SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.event_plannings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.todos SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.expenses SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.time_entries SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.habits SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.distribution_lists SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.call_logs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.planning_templates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.meeting_templates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.appointment_polls SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
END $$;

-- Now make tenant_id NOT NULL for core tables (after ensuring all data is migrated)
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.todos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.team_dashboards ALTER COLUMN tenant_id SET NOT NULL;