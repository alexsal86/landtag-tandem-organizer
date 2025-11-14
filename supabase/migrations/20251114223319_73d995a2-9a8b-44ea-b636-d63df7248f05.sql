-- Phase 1: Extend appointment_feedback table for external events support

-- Add external_event_id column (nullable, references external_events)
ALTER TABLE appointment_feedback 
ADD COLUMN IF NOT EXISTS external_event_id UUID REFERENCES external_events(id) ON DELETE CASCADE;

-- Add event_type column to distinguish between appointments and external events
ALTER TABLE appointment_feedback 
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'appointment';

-- Make appointment_id nullable since we now support external events too
ALTER TABLE appointment_feedback 
ALTER COLUMN appointment_id DROP NOT NULL;

-- Add constraint: Either appointment_id OR external_event_id must be set
ALTER TABLE appointment_feedback 
ADD CONSTRAINT appointment_feedback_event_check 
CHECK (
  (appointment_id IS NOT NULL AND external_event_id IS NULL) OR 
  (appointment_id IS NULL AND external_event_id IS NOT NULL)
);

-- Add unique constraint for external_event_id (one feedback per external event)
ALTER TABLE appointment_feedback 
ADD CONSTRAINT appointment_feedback_external_event_unique 
UNIQUE (external_event_id);

-- Update RLS policies to handle both event types

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view appointment feedback" ON appointment_feedback;
DROP POLICY IF EXISTS "Users can insert appointment feedback" ON appointment_feedback;
DROP POLICY IF EXISTS "Users can update appointment feedback" ON appointment_feedback;
DROP POLICY IF EXISTS "Users can delete appointment feedback" ON appointment_feedback;

-- Create new policies that handle both appointments and external events
CREATE POLICY "Users can view appointment feedback"
ON appointment_feedback FOR SELECT
USING (
  (user_id = auth.uid() AND appointment_id IS NOT NULL)
  OR
  (external_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM external_events ee
    JOIN external_calendars ec ON ec.id = ee.external_calendar_id
    WHERE ee.id = appointment_feedback.external_event_id 
    AND ec.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can insert appointment feedback"
ON appointment_feedback FOR INSERT
WITH CHECK (
  (user_id = auth.uid() AND appointment_id IS NOT NULL)
  OR
  (external_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM external_events ee
    JOIN external_calendars ec ON ec.id = ee.external_calendar_id
    WHERE ee.id = appointment_feedback.external_event_id 
    AND ec.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can update appointment feedback"
ON appointment_feedback FOR UPDATE
USING (
  (user_id = auth.uid() AND appointment_id IS NOT NULL)
  OR
  (external_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM external_events ee
    JOIN external_calendars ec ON ec.id = ee.external_calendar_id
    WHERE ee.id = appointment_feedback.external_event_id 
    AND ec.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can delete appointment feedback"
ON appointment_feedback FOR DELETE
USING (
  (user_id = auth.uid() AND appointment_id IS NOT NULL)
  OR
  (external_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM external_events ee
    JOIN external_calendars ec ON ec.id = ee.external_calendar_id
    WHERE ee.id = appointment_feedback.external_event_id 
    AND ec.user_id = auth.uid()
  ))
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_appointment_feedback_external_event 
ON appointment_feedback(external_event_id);

CREATE INDEX IF NOT EXISTS idx_appointment_feedback_event_type 
ON appointment_feedback(event_type);