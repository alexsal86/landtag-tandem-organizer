-- Call the import function to populate election districts from GeoJSON
SELECT net.http_post(
  url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/import-election-districts',
  headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50", "Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
) as request_id;