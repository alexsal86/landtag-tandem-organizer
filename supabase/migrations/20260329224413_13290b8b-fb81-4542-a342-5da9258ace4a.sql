
-- Map layers registry table
CREATE TABLE public.map_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  group_name text NOT NULL DEFAULT 'Allgemein',
  source_type text NOT NULL DEFAULT 'geojson_file' CHECK (source_type IN ('geojson_file', 'geojson_url', 'database')),
  source_path text,
  source_table text,
  stroke_color text NOT NULL DEFAULT '#3b82f6',
  fill_color text NOT NULL DEFAULT '#3b82f6',
  fill_opacity numeric NOT NULL DEFAULT 0.3,
  stroke_width numeric NOT NULL DEFAULT 2,
  stroke_dash_array text,
  icon text,
  visible_by_default boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  label_property text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read map layers for their tenant"
  ON public.map_layers FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage map layers"
  ON public.map_layers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'abgeordneter'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'abgeordneter'
    )
  );

CREATE TRIGGER update_map_layers_updated_at
  BEFORE UPDATE ON public.map_layers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
