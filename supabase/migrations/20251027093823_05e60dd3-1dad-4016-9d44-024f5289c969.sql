-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job for Matrix morning greeting
-- Runs every hour from 6:00 to 12:00
SELECT cron.schedule(
  'matrix-morning-greeting-hourly',
  '0 6-12 * * *',
  $$
  SELECT
    net.http_post(
        url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-matrix-morning-greeting',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50'
        ),
        body := jsonb_build_object(
          'triggered_at', now()::text
        )
    ) as request_id;
  $$
);

-- Create cron job for cleanup of old Matrix logs (runs daily at 2:00 AM)
SELECT cron.schedule(
  'matrix-logs-cleanup',
  '0 2 * * *',
  $$
  DELETE FROM matrix_bot_logs 
  WHERE timestamp < now() - INTERVAL '30 days';
  $$
);