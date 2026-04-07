CREATE TABLE IF NOT EXISTS public.social_content_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.social_content_channels(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  caption text,
  first_comment text,
  media_type text,
  asset_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  platform_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_content_variants_platform_status_check CHECK (platform_status IN ('draft', 'ready', 'scheduled', 'published', 'failed')),
  CONSTRAINT social_content_variants_media_type_check CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'carousel', 'link', 'text')),
  CONSTRAINT social_content_variants_unique_item_channel UNIQUE (content_item_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_social_content_variants_tenant ON public.social_content_variants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_content_variants_item ON public.social_content_variants (content_item_id);
CREATE INDEX IF NOT EXISTS idx_social_content_variants_channel ON public.social_content_variants (channel_id);

ALTER TABLE public.social_content_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_content_variants_select_scoped"
ON public.social_content_variants
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "social_content_variants_write_scoped"
ON public.social_content_variants
FOR ALL
TO authenticated
USING (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
)
WITH CHECK (
  public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter', 'bueroleitung', 'abgeordneter'])
);

DROP TRIGGER IF EXISTS update_social_content_variants_updated_at ON public.social_content_variants;
CREATE TRIGGER update_social_content_variants_updated_at
  BEFORE UPDATE ON public.social_content_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
