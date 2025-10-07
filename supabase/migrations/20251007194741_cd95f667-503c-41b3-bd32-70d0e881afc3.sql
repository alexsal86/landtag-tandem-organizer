-- Tabelle für RSS-Quellen (mandanten-spezifisch)
CREATE TABLE IF NOT EXISTS public.rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, url)
);

CREATE INDEX IF NOT EXISTS idx_rss_sources_tenant ON public.rss_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rss_sources_active ON public.rss_sources(is_active);

-- Tabelle für RSS-Einstellungen (mandanten-spezifisch)
CREATE TABLE IF NOT EXISTS public.rss_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  articles_per_feed INTEGER NOT NULL DEFAULT 10,
  total_articles_limit INTEGER NOT NULL DEFAULT 20,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 30,
  timeout_seconds INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- RLS aktivieren
ALTER TABLE public.rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies für rss_sources
CREATE POLICY "Users can view RSS sources in their tenant"
ON public.rss_sources FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can create RSS sources"
ON public.rss_sources FOR INSERT
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id) AND
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant admins can update RSS sources"
ON public.rss_sources FOR UPDATE
USING (
  is_tenant_admin(auth.uid(), tenant_id) AND
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant admins can delete RSS sources"
ON public.rss_sources FOR DELETE
USING (
  is_tenant_admin(auth.uid(), tenant_id) AND
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

-- RLS Policies für rss_settings
CREATE POLICY "Users can view RSS settings in their tenant"
ON public.rss_settings FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage RSS settings"
ON public.rss_settings FOR ALL
USING (
  is_tenant_admin(auth.uid(), tenant_id) AND
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

-- Trigger für updated_at
CREATE TRIGGER update_rss_sources_updated_at
  BEFORE UPDATE ON public.rss_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rss_settings_updated_at
  BEFORE UPDATE ON public.rss_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Default-Einstellungen für alle bestehenden Tenants erstellen
INSERT INTO public.rss_settings (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Beispiel-RSS-Quellen für bestehende Tenants (die hardcodierten Quellen aus der Edge Function)
INSERT INTO public.rss_sources (tenant_id, name, url, category, order_index, created_by)
SELECT 
  t.id as tenant_id,
  'Tagesschau' as name,
  'https://www.tagesschau.de/xml/rss2/' as url,
  'politik' as category,
  0 as order_index,
  COALESCE(
    (SELECT user_id FROM user_tenant_memberships WHERE tenant_id = t.id AND is_active = true LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
  ) as created_by
FROM public.tenants t
ON CONFLICT (tenant_id, url) DO NOTHING;

INSERT INTO public.rss_sources (tenant_id, name, url, category, order_index, created_by)
SELECT 
  t.id as tenant_id,
  'Deutsche Welle' as name,
  'https://rss.dw.com/xml/rss-de-all' as url,
  'politik' as category,
  1 as order_index,
  COALESCE(
    (SELECT user_id FROM user_tenant_memberships WHERE tenant_id = t.id AND is_active = true LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
  ) as created_by
FROM public.tenants t
ON CONFLICT (tenant_id, url) DO NOTHING;

INSERT INTO public.rss_sources (tenant_id, name, url, category, order_index, created_by)
SELECT 
  t.id as tenant_id,
  'FAZ Politik' as name,
  'https://www.faz.net/rss/aktuell/politik/' as url,
  'politik' as category,
  2 as order_index,
  COALESCE(
    (SELECT user_id FROM user_tenant_memberships WHERE tenant_id = t.id AND is_active = true LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
  ) as created_by
FROM public.tenants t
ON CONFLICT (tenant_id, url) DO NOTHING;