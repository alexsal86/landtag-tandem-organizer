-- Update existing calendar to use better sync parameters
UPDATE external_calendars 
SET 
  max_events = 5000,
  sync_start_date = '2024-01-01',
  sync_end_date = '2030-12-31'
WHERE id = '3d6e2d5b-fe74-4e94-ab69-6a5b91f72803';