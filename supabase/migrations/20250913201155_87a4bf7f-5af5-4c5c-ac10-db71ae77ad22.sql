-- Update existing external calendars to use higher event limits
UPDATE external_calendars 
SET max_events = 20000 
WHERE max_events IS NULL OR max_events < 20000;