
-- Feature 7: Rate Limiting table
CREATE TABLE public.automation_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  action_count integer NOT NULL DEFAULT 0,
  max_per_hour integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, action_type, window_start)
);

ALTER TABLE public.automation_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view rate limits"
  ON public.automation_rate_limits FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_memberships
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- Feature 8: Retry columns on automation_rule_runs
ALTER TABLE public.automation_rule_runs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Feature 5: DB triggers for contacts, knowledge_documents, case_files
CREATE OR REPLACE FUNCTION public.notify_automation_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/run-automation-rule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', current_setting('app.settings.automation_secret', true)
    ),
    body := jsonb_build_object(
      'ruleId', 'auto-detect',
      'sourcePayload', jsonb_build_object(
        'table', 'contacts',
        'id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'event', TG_OP
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_automation_case_files()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/run-automation-rule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', current_setting('app.settings.automation_secret', true)
    ),
    body := jsonb_build_object(
      'ruleId', 'auto-detect',
      'sourcePayload', jsonb_build_object(
        'table', 'case_files',
        'id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'status', NEW.status,
        'priority', NEW.priority,
        'event', TG_OP
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_automation_knowledge_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/run-automation-rule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', current_setting('app.settings.automation_secret', true)
    ),
    body := jsonb_build_object(
      'ruleId', 'auto-detect',
      'sourcePayload', jsonb_build_object(
        'table', 'knowledge_documents',
        'id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'status', NEW.status,
        'event', TG_OP
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Create triggers (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    DROP TRIGGER IF EXISTS automation_contacts_trigger ON public.contacts;
    CREATE TRIGGER automation_contacts_trigger
      AFTER INSERT OR UPDATE ON public.contacts
      FOR EACH ROW EXECUTE FUNCTION public.notify_automation_contacts();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_files') THEN
    DROP TRIGGER IF EXISTS automation_case_files_trigger ON public.case_files;
    CREATE TRIGGER automation_case_files_trigger
      AFTER INSERT OR UPDATE ON public.case_files
      FOR EACH ROW EXECUTE FUNCTION public.notify_automation_case_files();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_documents') THEN
    DROP TRIGGER IF EXISTS automation_knowledge_documents_trigger ON public.knowledge_documents;
    CREATE TRIGGER automation_knowledge_documents_trigger
      AFTER INSERT OR UPDATE ON public.knowledge_documents
      FOR EACH ROW EXECUTE FUNCTION public.notify_automation_knowledge_documents();
  END IF;
END;
$$;
