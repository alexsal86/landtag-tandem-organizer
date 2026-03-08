
-- ===================================================================
-- TENANT ISOLATION: Kategorie 1 + Kategorie 2
-- ===================================================================

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM user_tenant_memberships WHERE user_id = auth.uid() AND tenant_id = _tenant_id AND is_active = true); $$;

CREATE OR REPLACE FUNCTION public.is_tenant_config_admin(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM user_tenant_memberships WHERE user_id = auth.uid() AND tenant_id = _tenant_id AND is_active = true AND role IN ('abgeordneter', 'bueroleitung')); $$;

CREATE OR REPLACE FUNCTION public.is_same_tenant_leader(_target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM user_tenant_memberships utm_target
  JOIN user_tenant_memberships utm_caller ON utm_target.tenant_id = utm_caller.tenant_id
  WHERE utm_target.user_id = _target_user_id AND utm_target.is_active = true
  AND utm_caller.user_id = auth.uid() AND utm_caller.is_active = true
  AND utm_caller.role IN ('abgeordneter', 'bueroleitung')
); $$;

-- Drop ALL existing unique constraints
ALTER TABLE public.appointment_categories DROP CONSTRAINT IF EXISTS appointment_categories_name_key;
ALTER TABLE public.appointment_statuses DROP CONSTRAINT IF EXISTS appointment_statuses_name_key;
ALTER TABLE public.task_categories DROP CONSTRAINT IF EXISTS task_categories_name_key;
ALTER TABLE public.notification_types DROP CONSTRAINT IF EXISTS notification_types_name_key;
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_name_key;
ALTER TABLE public.document_categories DROP CONSTRAINT IF EXISTS document_categories_name_key;
ALTER TABLE public.case_file_types DROP CONSTRAINT IF EXISTS case_file_types_name_key;
ALTER TABLE public.topics DROP CONSTRAINT IF EXISTS topics_name_key;
ALTER TABLE public.case_file_processing_statuses DROP CONSTRAINT IF EXISTS case_file_processing_statuses_name_key;
ALTER TABLE public.public_holidays DROP CONSTRAINT IF EXISTS public_holidays_date_name_key;
ALTER TABLE public.public_holidays DROP CONSTRAINT IF EXISTS public_holidays_holiday_date_key;

-- Add tenant_id columns
ALTER TABLE public.appointment_categories ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.appointment_locations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.appointment_statuses ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.task_categories ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.case_file_types ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.case_file_processing_statuses ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.document_categories ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.admin_status_options ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.public_holidays ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE public.notification_types ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- Assign existing rows to main tenant
UPDATE public.appointment_categories SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.appointment_locations SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.appointment_statuses SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.tags SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.task_categories SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.case_file_types SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.case_file_processing_statuses SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.topics SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.document_categories SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.admin_status_options SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.public_holidays SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;
UPDATE public.notification_types SET tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' WHERE tenant_id IS NULL;

-- Duplicate data for other tenants
DO $$
DECLARE
  main_tid uuid := '2650522d-3c39-4734-b717-af3c188cc57c';
  other_tid uuid;
BEGIN
  FOR other_tid IN SELECT id FROM tenants WHERE is_active = true AND id != main_tid
  LOOP
    INSERT INTO appointment_categories (name, label, color, icon, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, is_active, order_index, other_tid FROM appointment_categories WHERE tenant_id = main_tid;

    INSERT INTO appointment_locations (name, label, color, icon, address, description, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, address, description, is_active, order_index, other_tid FROM appointment_locations WHERE tenant_id = main_tid;

    INSERT INTO appointment_statuses (name, label, color, icon, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, is_active, order_index, other_tid FROM appointment_statuses WHERE tenant_id = main_tid;

    INSERT INTO tags (name, label, color, icon, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, is_active, order_index, other_tid FROM tags WHERE tenant_id = main_tid;

    INSERT INTO task_categories (name, label, icon, color, is_active, order_index, tenant_id)
    SELECT name, label, icon, color, is_active, order_index, other_tid FROM task_categories WHERE tenant_id = main_tid;

    INSERT INTO case_file_types (name, label, color, icon, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, is_active, order_index, other_tid FROM case_file_types WHERE tenant_id = main_tid;

    INSERT INTO case_file_processing_statuses (name, label, color, icon, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, is_active, order_index, other_tid FROM case_file_processing_statuses WHERE tenant_id = main_tid;

    INSERT INTO topics (name, label, icon, color, description, order_index, is_active, tenant_id)
    SELECT name, label, icon, color, description, order_index, is_active, other_tid FROM topics WHERE tenant_id = main_tid;

    INSERT INTO document_categories (name, label, color, icon, is_active, order_index, tenant_id)
    SELECT name, label, color, icon, is_active, order_index, other_tid FROM document_categories WHERE tenant_id = main_tid;

    INSERT INTO admin_status_options (name, emoji, color, sort_order, is_active, tenant_id)
    SELECT name, emoji, color, sort_order, is_active, other_tid FROM admin_status_options WHERE tenant_id = main_tid;

    INSERT INTO public_holidays (holiday_date, name, is_nationwide, state, tenant_id)
    SELECT holiday_date, name, is_nationwide, state, other_tid FROM public_holidays WHERE tenant_id = main_tid;

    INSERT INTO notification_types (name, label, description, category, is_active, tenant_id)
    SELECT name, label, description, category, is_active, other_tid FROM notification_types WHERE tenant_id = main_tid;
  END LOOP;
END $$;

-- Set NOT NULL
ALTER TABLE public.appointment_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appointment_locations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appointment_statuses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tags ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.task_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.case_file_types ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.case_file_processing_statuses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.topics ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.document_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.admin_status_options ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.public_holidays ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notification_types ALTER COLUMN tenant_id SET NOT NULL;

-- Add composite unique constraints
ALTER TABLE public.appointment_categories ADD CONSTRAINT uq_appt_cat_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.appointment_statuses ADD CONSTRAINT uq_appt_stat_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.tags ADD CONSTRAINT uq_tags_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.task_categories ADD CONSTRAINT uq_task_cat_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.case_file_types ADD CONSTRAINT uq_cft_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.case_file_processing_statuses ADD CONSTRAINT uq_cfps_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.topics ADD CONSTRAINT uq_topics_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.document_categories ADD CONSTRAINT uq_doc_cat_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.admin_status_options ADD CONSTRAINT uq_admin_so_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.notification_types ADD CONSTRAINT uq_notif_types_tenant_name UNIQUE (tenant_id, name);
ALTER TABLE public.public_holidays ADD CONSTRAINT uq_holidays_tenant_date_name UNIQUE (tenant_id, holiday_date, name);

-- ===================================================================
-- RLS POLICIES: Kategorie 1
-- ===================================================================

DROP POLICY IF EXISTS "Admin roles can manage appointment categories" ON public.appointment_categories;
DROP POLICY IF EXISTS "Authenticated users can view appointment categories" ON public.appointment_categories;
CREATE POLICY "Tenant members can view appointment categories" ON public.appointment_categories FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage appointment categories" ON public.appointment_categories FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admin roles can manage appointment locations" ON public.appointment_locations;
DROP POLICY IF EXISTS "Authenticated users can view appointment locations" ON public.appointment_locations;
CREATE POLICY "Tenant members can view appointment locations" ON public.appointment_locations FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage appointment locations" ON public.appointment_locations FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admin roles can manage appointment statuses" ON public.appointment_statuses;
DROP POLICY IF EXISTS "Authenticated users can view appointment statuses" ON public.appointment_statuses;
CREATE POLICY "Tenant members can view appointment statuses" ON public.appointment_statuses FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage appointment statuses" ON public.appointment_statuses FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admins can manage tags" ON public.tags;
DROP POLICY IF EXISTS "Authenticated users can view active tags" ON public.tags;
CREATE POLICY "Tenant members can view tags" ON public.tags FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage tags" ON public.tags FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admin roles can manage task categories" ON public.task_categories;
DROP POLICY IF EXISTS "Authenticated users can view task categories" ON public.task_categories;
CREATE POLICY "Tenant members can view task categories" ON public.task_categories FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage task categories" ON public.task_categories FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admin roles can manage case file types" ON public.case_file_types;
DROP POLICY IF EXISTS "Everyone can view active case file types" ON public.case_file_types;
CREATE POLICY "Tenant members can view case file types" ON public.case_file_types FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage case file types" ON public.case_file_types FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage processing statuses" ON public.case_file_processing_statuses;
DROP POLICY IF EXISTS "Everyone can view processing statuses" ON public.case_file_processing_statuses;
CREATE POLICY "Tenant members can view processing statuses" ON public.case_file_processing_statuses FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage processing statuses" ON public.case_file_processing_statuses FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admin roles can manage topics" ON public.topics;
DROP POLICY IF EXISTS "Everyone can view active topics" ON public.topics;
CREATE POLICY "Tenant members can view topics" ON public.topics FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY "Tenant admins can manage topics" ON public.topics FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admin roles can manage document categories" ON public.document_categories;
DROP POLICY IF EXISTS "Authenticated users can view document categories" ON public.document_categories;
CREATE POLICY "Tenant members can view document categories" ON public.document_categories FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage document categories" ON public.document_categories FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Abgeordnete can manage status options" ON public.admin_status_options;
DROP POLICY IF EXISTS "Everyone can view status options" ON public.admin_status_options;
CREATE POLICY "Tenant members can view status options" ON public.admin_status_options FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage status options" ON public.admin_status_options FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Only admins can manage holidays" ON public.public_holidays;
DROP POLICY IF EXISTS "Anyone can view public holidays" ON public.public_holidays;
CREATE POLICY "Tenant members can view holidays" ON public.public_holidays FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY "Tenant admins can manage holidays" ON public.public_holidays FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP POLICY IF EXISTS "Admins can manage notification types" ON public.notification_types;
DROP POLICY IF EXISTS "Everyone can view notification types" ON public.notification_types;
CREATE POLICY "Tenant members can view notification types" ON public.notification_types FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);
CREATE POLICY "Tenant admins can manage notification types" ON public.notification_types FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id)) WITH CHECK (public.is_tenant_config_admin(tenant_id));

-- ===================================================================
-- KATEGORIE 2: HR Policies
-- ===================================================================

DROP POLICY IF EXISTS "Leaders can manage yearly stats" ON public.employee_yearly_stats;
DROP POLICY IF EXISTS "Leaders can view all yearly stats" ON public.employee_yearly_stats;
CREATE POLICY "Tenant leaders can manage yearly stats" ON public.employee_yearly_stats FOR ALL TO authenticated USING (public.is_same_tenant_leader(user_id)) WITH CHECK (public.is_same_tenant_leader(user_id));
CREATE POLICY "Tenant leaders can view yearly stats" ON public.employee_yearly_stats FOR SELECT TO authenticated USING (public.is_same_tenant_leader(user_id));

DROP POLICY IF EXISTS "Admins can view all vacation history" ON public.vacation_history;
DROP POLICY IF EXISTS "System can insert vacation history" ON public.vacation_history;
DROP POLICY IF EXISTS "System can update vacation history" ON public.vacation_history;
CREATE POLICY "Tenant leaders can view vacation history" ON public.vacation_history FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_same_tenant_leader(user_id));
CREATE POLICY "Tenant leaders can insert vacation history" ON public.vacation_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_same_tenant_leader(user_id));
CREATE POLICY "Tenant leaders can update vacation history" ON public.vacation_history FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_same_tenant_leader(user_id));

DROP POLICY IF EXISTS "Admins can manage corrections" ON public.time_entry_corrections;
CREATE POLICY "Tenant leaders can manage corrections" ON public.time_entry_corrections FOR ALL TO authenticated USING (public.is_same_tenant_leader(user_id)) WITH CHECK (public.is_same_tenant_leader(user_id));

DROP POLICY IF EXISTS "employee_settings_insert_scoped" ON public.employee_settings;
CREATE POLICY "employee_settings_insert_scoped" ON public.employee_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_same_tenant_leader(user_id));
