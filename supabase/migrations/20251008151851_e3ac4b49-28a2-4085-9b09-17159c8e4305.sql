-- Enable required extensions for scheduled email processing
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'process-scheduled-emails-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/process-scheduled-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50"}'::jsonb,
    body := '{"source": "cron", "time": "' || now()::text || '"}'::jsonb
  ) AS request_id;
  $$
);