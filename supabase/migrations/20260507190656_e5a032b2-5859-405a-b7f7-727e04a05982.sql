
-- Idempotent: vorhandene Jobs entfernen, dann neu anlegen
DO $$
BEGIN
  PERFORM cron.unschedule('security-rls-snapshot-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='security-rls-snapshot-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('selftest-backup-pointer-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='selftest-backup-pointer-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'security-rls-snapshot-daily',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/rest/v1/rpc/snapshot_rls_coverage',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'selftest-backup-pointer-daily',
  '30 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/selftest-backup-pointer',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
