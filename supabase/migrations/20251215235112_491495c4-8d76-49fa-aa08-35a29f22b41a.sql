-- Feature 1: Topics-Integration für Map Flags
CREATE TABLE IF NOT EXISTS public.map_flag_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.map_flags(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(flag_id, topic_id)
);

ALTER TABLE public.map_flag_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "map_flag_topics_tenant_access" ON public.map_flag_topics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.map_flags f WHERE f.id = map_flag_topics.flag_id 
            AND f.tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  );

-- Feature 3: District Notes
CREATE TABLE IF NOT EXISTS public.district_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES public.karlsruhe_districts(id) ON DELETE CASCADE,
  content text,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, district_id)
);

ALTER TABLE public.district_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_notes_tenant_access" ON public.district_notes
  FOR ALL USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- Feature 2: Saved Routes (optional persistence)
CREATE TABLE IF NOT EXISTS public.map_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  waypoints jsonb NOT NULL DEFAULT '[]',
  distance_meters numeric,
  duration_seconds numeric,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.map_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "map_routes_tenant_access" ON public.map_routes
  FOR ALL USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));