-- Erstelle Feedback-Einträge für alle externen Events der letzten 7 Tage ohne Feedback
INSERT INTO appointment_feedback (
  external_event_id,
  user_id,
  tenant_id,
  event_type,
  feedback_status,
  priority_score
)
SELECT 
  ee.id,
  ec.user_id,
  ec.tenant_id,
  'external_event',
  'pending',
  1
FROM external_events ee
JOIN external_calendars ec ON ee.external_calendar_id = ec.id
LEFT JOIN appointment_feedback af ON af.external_event_id = ee.id
WHERE ee.start_time >= NOW() - INTERVAL '7 days'
  AND ee.end_time <= NOW()
  AND af.id IS NULL
ON CONFLICT (external_event_id) DO NOTHING;

-- Verhindert doppelte Feedback-Einträge für externe Events (falls Constraint noch nicht existiert)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_external_event_feedback'
  ) THEN
    ALTER TABLE appointment_feedback 
    ADD CONSTRAINT unique_external_event_feedback 
    UNIQUE (external_event_id);
  END IF;
END $$;