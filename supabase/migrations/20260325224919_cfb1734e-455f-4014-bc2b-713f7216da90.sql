
-- ============================================================
-- Dossiers: eigenständige thematische Sammlungen
-- ============================================================
CREATE TABLE public.dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'aktiv',
  priority text NOT NULL DEFAULT 'mittel',
  owner_id uuid REFERENCES public.profiles(id),
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view dossiers"
  ON public.dossiers FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenant members can insert dossiers"
  ON public.dossiers FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenant members can update dossiers"
  ON public.dossiers FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenant members can delete dossiers"
  ON public.dossiers FOR DELETE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- ============================================================
-- Dossier-Einträge: Notizen, Dateien, Links, E-Mails, Zitate
-- dossier_id = NULL → Eingangskorb
-- ============================================================
CREATE TABLE public.dossier_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'notiz',
  title text,
  content text,
  source_url text,
  file_path text,
  file_name text,
  metadata jsonb DEFAULT '{}',
  is_curated boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dossier_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view dossier_entries"
  ON public.dossier_entries FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenant members can insert dossier_entries"
  ON public.dossier_entries FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenant members can update dossier_entries"
  ON public.dossier_entries FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenant members can delete dossier_entries"
  ON public.dossier_entries FOR DELETE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- ============================================================
-- Dossier-Verknüpfungen: polymorphe Links zu anderen Entitäten
-- ============================================================
CREATE TABLE public.dossier_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  linked_type text NOT NULL,
  linked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dossier_id, linked_type, linked_id)
);

ALTER TABLE public.dossier_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage dossier_links via dossier"
  ON public.dossier_links FOR ALL TO authenticated
  USING (dossier_id IN (
    SELECT id FROM public.dossiers
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Indices for common queries
CREATE INDEX idx_dossiers_tenant ON public.dossiers(tenant_id);
CREATE INDEX idx_dossiers_topic ON public.dossiers(topic_id);
CREATE INDEX idx_dossier_entries_dossier ON public.dossier_entries(dossier_id);
CREATE INDEX idx_dossier_entries_tenant ON public.dossier_entries(tenant_id);
CREATE INDEX idx_dossier_entries_inbox ON public.dossier_entries(tenant_id) WHERE dossier_id IS NULL;
CREATE INDEX idx_dossier_links_dossier ON public.dossier_links(dossier_id);
CREATE INDEX idx_dossier_links_target ON public.dossier_links(linked_type, linked_id);
