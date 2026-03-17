-- Domain model for Themen-Backlog und Social-Content-Planung

CREATE TABLE IF NOT EXISTS public.topic_backlog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  topic text NOT NULL,
  short_description text,
  cluster text,
  priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'research', 'ready', 'in_progress', 'done', 'archived')),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  topic_backlog_id uuid NOT NULL REFERENCES public.topic_backlog(id) ON DELETE CASCADE,
  format text,
  hook text,
  core_message text,
  cta text,
  draft_text text,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  workflow_status text NOT NULL DEFAULT 'idea' CHECK (workflow_status IN ('idea', 'draft', 'approval', 'scheduled', 'published')),
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft', 'pending_approval', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_for timestamptz,
  published_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_content_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.social_content_item_channels (
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.social_content_channels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  PRIMARY KEY (content_item_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_backlog_tenant_status ON public.topic_backlog (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_social_content_items_tenant_workflow ON public.social_content_items (tenant_id, workflow_status);
CREATE INDEX IF NOT EXISTS idx_social_content_item_channels_tenant ON public.social_content_item_channels (tenant_id);

ALTER TABLE public.topic_backlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_item_channels ENABLE ROW LEVEL SECURITY;

-- Lesen: alle aktiven Teammitglieder im Tenant
CREATE POLICY "topic_backlog_select_scoped"
ON public.topic_backlog
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "social_content_items_select_scoped"
ON public.social_content_items
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "social_content_channels_select_scoped"
ON public.social_content_channels
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "social_content_item_channels_select_scoped"
ON public.social_content_item_channels
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Schreiben: Mitarbeiter + Büroleitung + Abgeordnete
CREATE POLICY "topic_backlog_write_scoped"
ON public.topic_backlog
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "topic_backlog_update_scoped"
ON public.topic_backlog
FOR UPDATE
TO authenticated
USING (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
)
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "social_content_items_write_scoped"
ON public.social_content_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "social_content_items_update_scoped"
ON public.social_content_items
FOR UPDATE
TO authenticated
USING (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
)
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "social_content_channels_write_scoped"
ON public.social_content_channels
FOR ALL
TO authenticated
USING (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
)
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "social_content_item_channels_write_scoped"
ON public.social_content_item_channels
FOR ALL
TO authenticated
USING (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
)
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

-- Freigeben/Löschen: nur Büroleitung + Abgeordnete
CREATE POLICY "topic_backlog_delete_admin_scoped"
ON public.topic_backlog
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "social_content_items_delete_admin_scoped"
ON public.social_content_items
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.enforce_social_content_approval_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.approval_state IS DISTINCT FROM OLD.approval_state
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
  ) THEN
    IF NOT public.is_tenant_admin(auth.uid(), NEW.tenant_id) THEN
      RAISE EXCEPTION 'Nur Büroleitung/Abgeordnete dürfen Freigaben ändern.';
    END IF;

    IF NEW.approval_state = 'approved' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    ELSIF NEW.approval_state IN ('draft', 'pending_approval') THEN
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_content_approval_permissions ON public.social_content_items;
CREATE TRIGGER trg_social_content_approval_permissions
  BEFORE UPDATE ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_social_content_approval_permissions();

DROP TRIGGER IF EXISTS update_topic_backlog_updated_at ON public.topic_backlog;
CREATE TRIGGER update_topic_backlog_updated_at
  BEFORE UPDATE ON public.topic_backlog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_content_items_updated_at ON public.social_content_items;
CREATE TRIGGER update_social_content_items_updated_at
  BEFORE UPDATE ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_content_channels_updated_at ON public.social_content_channels;
CREATE TRIGGER update_social_content_channels_updated_at
  BEFORE UPDATE ON public.social_content_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Optionale Startdaten für Standardkanäle (pro Tenant)
INSERT INTO public.social_content_channels (tenant_id, name, slug, sort_order)
SELECT t.id, seed.name, seed.slug, seed.sort_order
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('Instagram', 'instagram', 10),
    ('Facebook', 'facebook', 20),
    ('LinkedIn', 'linkedin', 30),
    ('X/Twitter', 'x', 40),
    ('Newsletter', 'newsletter', 50)
) AS seed(name, slug, sort_order)
ON CONFLICT (tenant_id, slug) DO NOTHING;
