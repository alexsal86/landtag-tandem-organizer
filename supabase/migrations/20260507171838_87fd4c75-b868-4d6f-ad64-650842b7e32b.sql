
-- Falls bereits vorhanden, alte Jobs entfernen
DO $$
BEGIN
  PERFORM cron.unschedule('collect-egress-metrics-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('check-egress-anomaly-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'collect-egress-metrics-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/collect-egress-metrics',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);

SELECT cron.schedule(
  'check-egress-anomaly-daily',
  '15 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/check-egress-anomaly',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);
