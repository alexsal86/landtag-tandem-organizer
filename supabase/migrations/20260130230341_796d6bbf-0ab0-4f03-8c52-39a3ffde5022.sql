-- =====================================================
-- UMFASSENDE TENANT-ISOLATION MIGRATION
-- =====================================================

-- 1. app_settings: tenant_id hinzufügen
-- =====================================================
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Unique-Constraint für tenant-spezifische Settings
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_tenant_key 
ON public.app_settings(tenant_id, setting_key) 
WHERE tenant_id IS NOT NULL;

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant ON public.app_settings(tenant_id);

-- RLS-Policies für app_settings anpassen
DROP POLICY IF EXISTS "App settings are viewable by everyone" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin users can manage app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can manage app settings" ON public.app_settings;

-- Neue Policies für app_settings
CREATE POLICY "Users can view settings in their tenant or global"
ON public.app_settings FOR SELECT
USING (
  tenant_id IS NULL 
  OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Superadmin can manage global settings"
ON public.app_settings FOR ALL
USING (
  is_superadmin(auth.uid())
);

CREATE POLICY "Tenant admins can manage their tenant settings"
ON public.app_settings FOR ALL
USING (
  tenant_id IS NOT NULL 
  AND is_tenant_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  tenant_id IS NOT NULL 
  AND is_tenant_admin(auth.uid(), tenant_id)
);

-- 2. audit_log_entries: tenant_id hinzufügen
-- =====================================================
ALTER TABLE public.audit_log_entries 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log_entries(tenant_id);

-- RLS für audit_log_entries anpassen
DROP POLICY IF EXISTS "Admin users can view audit logs" ON public.audit_log_entries;
DROP POLICY IF EXISTS "Users can view audit logs in their tenant" ON public.audit_log_entries;

CREATE POLICY "Superadmin can view all audit logs"
ON public.audit_log_entries FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Tenant admins can view their audit logs"
ON public.audit_log_entries FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL 
  AND tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND is_admin(auth.uid())
);

-- 3. meeting_templates: RLS auf Tenant beschränken
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can create all meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Authenticated users can delete all meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Authenticated users can update all meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Authenticated users can view all meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Users can view templates in their tenant" ON public.meeting_templates;
DROP POLICY IF EXISTS "Tenant admins can manage templates" ON public.meeting_templates;

CREATE POLICY "Users can view templates in their tenant"
ON public.meeting_templates FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create templates in their tenant"
ON public.meeting_templates FOR INSERT
WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update templates in their tenant"
ON public.meeting_templates FOR UPDATE
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete templates in their tenant"
ON public.meeting_templates FOR DELETE
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- 4. task_decisions: RLS korrigieren (visible_to_all + tenant)
-- =====================================================
DROP POLICY IF EXISTS "task_decisions_allow_authenticated" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can view decisions they're involved in" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can view decisions in their tenant" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can create decisions in their tenant" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can update their decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can delete their decisions" ON public.task_decisions;

CREATE POLICY "Users can view decisions in their tenant"
ON public.task_decisions FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND (
    created_by = auth.uid()
    OR visible_to_all = true
    OR EXISTS (
      SELECT 1 FROM public.task_decision_participants
      WHERE decision_id = task_decisions.id AND user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create decisions in their tenant"
ON public.task_decisions FOR INSERT
WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their decisions"
ON public.task_decisions FOR UPDATE
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND created_by = auth.uid()
);

CREATE POLICY "Users can delete their decisions"
ON public.task_decisions FOR DELETE
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND created_by = auth.uid()
);

-- 5. user_status: RLS auf Tenant beschränken
-- =====================================================
DROP POLICY IF EXISTS "Users can view all statuses" ON public.user_status;
DROP POLICY IF EXISTS "Users can view status in their tenant" ON public.user_status;

CREATE POLICY "Users can view status in their tenant"
ON public.user_status FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  OR user_id = auth.uid()
);

-- 6. Stephanie Schellin's fehlendes Profil und Status erstellen
-- =====================================================
INSERT INTO public.profiles (user_id, display_name, tenant_id)
SELECT 
  '12119701-6263-4d8b-940f-c69397fd841d',
  'Stephanie Schellin',
  '5a65ce13-af54-439f-becf-e23e458627d9'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = '12119701-6263-4d8b-940f-c69397fd841d'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_status (user_id, tenant_id, status_type, notifications_enabled)
SELECT 
  '12119701-6263-4d8b-940f-c69397fd841d',
  '5a65ce13-af54-439f-becf-e23e458627d9',
  'online',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_status WHERE user_id = '12119701-6263-4d8b-940f-c69397fd841d'
)
ON CONFLICT (user_id) DO NOTHING;