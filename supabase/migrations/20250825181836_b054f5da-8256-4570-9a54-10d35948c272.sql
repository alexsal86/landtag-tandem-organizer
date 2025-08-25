-- Multi-Tenant Architecture Implementation
-- Phase 1: Core tenant structure and user-tenant relationships

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create user-tenant memberships table (M:N relationship)
CREATE TABLE public.user_tenant_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'mitarbeiter',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS on user_tenant_memberships
ALTER TABLE public.user_tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Create tenant collaborations table for future cross-tenant sharing
CREATE TABLE public.tenant_collaborations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_a_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_b_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  collaboration_type TEXT NOT NULL DEFAULT 'project_sharing',
  is_active BOOLEAN NOT NULL DEFAULT true,
  approved_by_a UUID,
  approved_by_b UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_a_id, tenant_b_id)
);

-- Enable RLS on tenant_collaborations
ALTER TABLE public.tenant_collaborations ENABLE ROW LEVEL SECURITY;

-- Add tenant_id to existing core tables
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.contacts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tasks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.appointments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.documents ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.meetings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.team_dashboards ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.messages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.user_status ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.notifications ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.knowledge_documents ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.event_plannings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.todos ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.expenses ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.time_entries ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.habits ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.distribution_lists ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.call_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.planning_templates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.meeting_templates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.appointment_polls ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Create default tenant for existing data
INSERT INTO public.tenants (name, description, settings) 
VALUES ('Standard Büro', 'Standard Tenant für bestehende Daten', '{}');

-- Get the default tenant ID for data migration
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants WHERE name = 'Standard Büro' LIMIT 1;
  
  -- Migrate existing data to default tenant
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
  
  -- Create user-tenant memberships for existing users
  INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role)
  SELECT 
    p.user_id, 
    default_tenant_id,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'abgeordneter') THEN 'abgeordneter'
      WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'bueroleitung') THEN 'bueroleitung'
      ELSE 'mitarbeiter'
    END
  FROM public.profiles p
  WHERE p.tenant_id = default_tenant_id
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
END $$;

-- Create security functions for tenant access
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[] 
LANGUAGE sql 
STABLE SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(tenant_id) 
  FROM public.user_tenant_memberships 
  WHERE user_id = _user_id AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_user_primary_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id 
  FROM public.user_tenant_memberships 
  WHERE user_id = _user_id AND is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships 
    WHERE user_id = _user_id 
    AND tenant_id = _tenant_id 
    AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships 
    WHERE user_id = _user_id 
    AND tenant_id = _tenant_id 
    AND role IN ('abgeordneter', 'bueroleitung')
    AND is_active = true
  );
$$;

-- RLS Policies for tenants table
CREATE POLICY "Users can view tenants they belong to" 
ON public.tenants 
FOR SELECT 
USING (
  id = ANY(public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant admins can update their tenant" 
ON public.tenants 
FOR UPDATE 
USING (
  public.is_tenant_admin(auth.uid(), id)
);

-- RLS Policies for user_tenant_memberships
CREATE POLICY "Users can view their own memberships" 
ON public.user_tenant_memberships 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Tenant admins can view memberships in their tenants" 
ON public.user_tenant_memberships 
FOR SELECT 
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can manage memberships in their tenants" 
ON public.user_tenant_memberships 
FOR ALL 
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
);

-- Add triggers for updated_at columns
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_tenant_memberships_updated_at
  BEFORE UPDATE ON public.user_tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_collaborations_updated_at
  BEFORE UPDATE ON public.tenant_collaborations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();