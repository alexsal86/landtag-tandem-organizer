-- Create enum for flag metadata
CREATE TYPE flag_visibility AS ENUM ('public', 'private', 'team');

-- Create map_flag_types table
CREATE TABLE public.map_flag_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📍',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Create map_flags table
CREATE TABLE public.map_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  flag_type_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  coordinates JSONB NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_flag_type FOREIGN KEY (flag_type_id) REFERENCES public.map_flag_types(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.map_flag_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for map_flag_types
CREATE POLICY "Users can view flag types in their tenant"
  ON public.map_flag_types FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage flag types"
  ON public.map_flag_types FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- RLS Policies for map_flags
CREATE POLICY "Users can view flags in their tenant"
  ON public.map_flags FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create flags in their tenant"
  ON public.map_flags FOR INSERT
  WITH CHECK (
    tenant_id = ANY(get_user_tenant_ids(auth.uid())) 
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own flags"
  ON public.map_flags FOR UPDATE
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid())) 
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own flags"
  ON public.map_flags FOR DELETE
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid())) 
    AND created_by = auth.uid()
  );

-- Create indexes
CREATE INDEX idx_map_flag_types_tenant ON public.map_flag_types(tenant_id);
CREATE INDEX idx_map_flag_types_active ON public.map_flag_types(tenant_id, is_active);
CREATE INDEX idx_map_flags_tenant ON public.map_flags(tenant_id);
CREATE INDEX idx_map_flags_type ON public.map_flags(flag_type_id);
CREATE INDEX idx_map_flags_coords ON public.map_flags USING GIN(coordinates);
CREATE INDEX idx_map_flags_created_by ON public.map_flags(created_by);

-- Create update trigger for updated_at
CREATE TRIGGER update_map_flag_types_updated_at
  BEFORE UPDATE ON public.map_flag_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_map_flags_updated_at
  BEFORE UPDATE ON public.map_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();