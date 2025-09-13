-- Add configuration columns to external_calendars for incremental sync
ALTER TABLE public.external_calendars 
ADD COLUMN sync_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '2 years'),
ADD COLUMN sync_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '2 years'),
ADD COLUMN max_events INTEGER DEFAULT 2000,
ADD COLUMN last_successful_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_errors_count INTEGER DEFAULT 0,
ADD COLUMN last_sync_error TEXT;

-- Add index on external_events for faster UPSERT operations
CREATE INDEX IF NOT EXISTS idx_external_events_calendar_uid 
ON public.external_events (external_calendar_id, external_uid);

-- Add index on last_modified for change detection
CREATE INDEX IF NOT EXISTS idx_external_events_last_modified 
ON public.external_events (external_calendar_id, last_modified);