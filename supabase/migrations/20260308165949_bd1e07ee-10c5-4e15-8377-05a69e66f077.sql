-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper function: fires run-automation-rule for record_changed
CREATE OR REPLACE FUNCTION public.notify_automation_record_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url    text;
  _service_role    text;
  _cron_secret     text;
  _table_name      text;
  _tenant_id       uuid;
  _record_id       uuid;
  _operation        text;
  _payload         jsonb;
  _rules           record;
BEGIN
  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_role
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO _cron_secret
    FROM vault.decrypted_secrets WHERE name = 'AUTOMATION_CRON_SECRET' LIMIT 1;

  IF _supabase_url IS NULL OR _service_role IS NULL OR _cron_secret IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _table_name := TG_TABLE_NAME;
  _operation  := TG_OP;

  IF TG_OP = 'DELETE' THEN
    _tenant_id := (OLD).tenant_id;
    _record_id := (OLD).id;
  ELSE
    _tenant_id := (NEW).tenant_id;
    _record_id := (NEW).id;
  END IF;

  _payload := jsonb_build_object(
    'source',      'record_changed',
    'table_name',  _table_name,
    'operation',   _operation,
    'record_id',   _record_id,
    'tenant_id',   _tenant_id,
    'old_data',    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    'new_data',    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  FOR _rules IN
    SELECT id, name
    FROM public.automation_rules
    WHERE tenant_id = _tenant_id
      AND enabled = true
      AND trigger_type = 'record_changed'
      AND (
        trigger_config->>'table_name' = _table_name
        OR trigger_config->>'table_name' IS NULL
      )
  LOOP
    PERFORM net.http_post(
      url     := _supabase_url || '/functions/v1/run-automation-rule',
      headers := jsonb_build_object(
        'Content-Type',        'application/json',
        'apikey',              _service_role,
        'Authorization',       'Bearer ' || _service_role,
        'x-automation-secret', _cron_secret
      ),
      body    := jsonb_build_object(
        'ruleId',          _rules.id,
        'dryRun',          false,
        'idempotencyKey',  gen_random_uuid()::text,
        'sourcePayload',   _payload
      )
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- TASKS
DROP TRIGGER IF EXISTS trg_automation_record_changed_tasks ON public.tasks;
CREATE TRIGGER trg_automation_record_changed_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_record_changed();

-- MEETINGS
DROP TRIGGER IF EXISTS trg_automation_record_changed_meetings ON public.meetings;
CREATE TRIGGER trg_automation_record_changed_meetings
  AFTER INSERT OR UPDATE OR DELETE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_record_changed();

-- TASK_DECISIONS
DROP TRIGGER IF EXISTS trg_automation_record_changed_task_decisions ON public.task_decisions;
CREATE TRIGGER trg_automation_record_changed_task_decisions
  AFTER INSERT OR UPDATE OR DELETE ON public.task_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_record_changed();