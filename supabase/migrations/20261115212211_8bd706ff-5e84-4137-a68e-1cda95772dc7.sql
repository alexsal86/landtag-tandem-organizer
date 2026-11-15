-- lovable-cron-fallback-reviewed: Fuenfminuetige SQL-Fälligkeitsprüfung bleibt für die E-Mail-Zustellung erforderlich; HTTP-Aufrufe entstehen nur bei fälliger Arbeit.
-- Run as the database administration role postgres, never anon/authenticated.
-- Do not depend on installation-specific job IDs (e.g. 3 or 6).
-- Keep the email delivery interval, but invoke the function only when work is due.
CREATE OR REPLACE FUNCTION public.dispatch_scheduled_emails_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  project_url text;
  service_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.scheduled_emails
    WHERE status = 'scheduled' AND scheduled_for <= now()
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets
  WHERE name IN ('supabase_url', 'project_url')
  ORDER BY CASE name WHEN 'supabase_url' THEN 0 ELSE 1 END LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END LIMIT 1;

  IF project_url IS NULL OR service_key IS NULL THEN
    RAISE EXCEPTION 'Email cron requires project_url/supabase_url and service_role_key in Vault';
  END IF;

  PERFORM net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || service_key),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_scheduled_emails_if_due() FROM PUBLIC, anon, authenticated;
