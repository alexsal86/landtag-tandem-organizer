-- Performance indexes for the most common query patterns

-- Tasks: frequently filtered by user_id + status + parent_task_id
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_parent
  ON public.tasks (user_id, status) WHERE parent_task_id IS NULL;

-- Tasks: assigned_to text search pattern
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status
  ON public.tasks (status) WHERE parent_task_id IS NULL AND status != 'completed';

-- Task snoozes: lookup by user_id
CREATE INDEX IF NOT EXISTS idx_task_snoozes_user
  ON public.task_snoozes (user_id);

-- Task comments: count by task_id
CREATE INDEX IF NOT EXISTS idx_task_comments_task
  ON public.task_comments (task_id);

-- Appointments: tenant + time range (dashboard & calendar queries)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start
  ON public.appointments (tenant_id, start_time);

-- External events: start_time range scans
CREATE INDEX IF NOT EXISTS idx_external_events_start
  ON public.external_events (start_time);

-- Profiles: fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- User roles: fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles (user_id);

-- Documents: tenant + created_at for paginated listing
CREATE INDEX IF NOT EXISTS idx_documents_tenant_created
  ON public.documents (tenant_id, created_at DESC);

-- Task decision comments: count by decision_id
CREATE INDEX IF NOT EXISTS idx_task_decision_comments_decision
  ON public.task_decision_comments (decision_id);

-- App settings: lookup by key + tenant
CREATE INDEX IF NOT EXISTS idx_app_settings_key_tenant
  ON public.app_settings (setting_key, tenant_id);