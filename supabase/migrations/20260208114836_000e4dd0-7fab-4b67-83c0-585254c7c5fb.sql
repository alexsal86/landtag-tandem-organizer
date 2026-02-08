
-- Create press_releases table
CREATE TABLE public.press_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_by uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  content_html text,
  content_nodes jsonb,
  slug text,
  excerpt text,
  feature_image_url text,
  tags text[],
  meta_title text,
  meta_description text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  submitted_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  revision_comment text,
  revision_requested_at timestamptz,
  revision_requested_by uuid,
  published_at timestamptz,
  ghost_post_id text,
  ghost_post_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.press_releases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant members can view press releases"
ON public.press_releases FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Tenant members can insert press releases"
ON public.press_releases FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
) AND created_by = auth.uid());

CREATE POLICY "Tenant members can update press releases"
ON public.press_releases FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_tenant_memberships
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Creator can delete draft press releases"
ON public.press_releases FOR DELETE
USING (created_by = auth.uid() AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_press_releases_updated_at
BEFORE UPDATE ON public.press_releases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for tenant queries
CREATE INDEX idx_press_releases_tenant_id ON public.press_releases(tenant_id);
CREATE INDEX idx_press_releases_status ON public.press_releases(status);
CREATE INDEX idx_press_releases_created_by ON public.press_releases(created_by);
