CREATE TABLE IF NOT EXISTS public.social_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text,
  target_audience text,
  message_house text,
  start_date date,
  end_date date,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_social_campaigns_tenant_status ON public.social_campaigns (tenant_id, status);

ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_campaigns_select_scoped"
ON public.social_campaigns
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "social_campaigns_write_scoped"
ON public.social_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "social_campaigns_update_scoped"
ON public.social_campaigns
FOR UPDATE
TO authenticated
USING (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
)
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

CREATE POLICY "social_campaigns_delete_admin_scoped"
ON public.social_campaigns
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

DROP TRIGGER IF EXISTS update_social_campaigns_updated_at ON public.social_campaigns;
CREATE TRIGGER update_social_campaigns_updated_at
  BEFORE UPDATE ON public.social_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.topic_backlog
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.social_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_pillar text CHECK (content_pillar IN ('informieren', 'mobilisieren', 'service'));

ALTER TABLE public.social_content_items
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.social_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_pillar text CHECK (content_pillar IN ('informieren', 'mobilisieren', 'service'));

CREATE INDEX IF NOT EXISTS idx_topic_backlog_campaign ON public.topic_backlog (tenant_id, campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_content_items_campaign ON public.social_content_items (tenant_id, campaign_id) WHERE campaign_id IS NOT NULL;
