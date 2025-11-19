-- Drop all triggers first
DROP TRIGGER IF EXISTS time_entries_history_trigger ON time_entries;
DROP TRIGGER IF EXISTS log_time_entry_history ON time_entries;
DROP TRIGGER IF EXISTS time_entry_history_trigger ON time_entries;

-- Drop old functions
DROP FUNCTION IF EXISTS log_time_entry_changes() CASCADE;
DROP FUNCTION IF EXISTS log_time_entry_change() CASCADE;
DROP FUNCTION IF EXISTS log_time_entry_history() CASCADE;

-- Create the correct function (time_entries uses work_date, time_entry_history uses entry_date)
CREATE OR REPLACE FUNCTION log_time_entry_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.time_entry_history (
      time_entry_id, user_id, entry_date, started_at, ended_at,
      minutes, pause_minutes, notes, change_type, changed_by
    ) VALUES (
      OLD.id, OLD.user_id, OLD.work_date, OLD.started_at, OLD.ended_at,
      OLD.minutes, COALESCE(OLD.pause_minutes, 0), OLD.notes, 'updated', auth.uid()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_entry_history (
      time_entry_id, user_id, entry_date, started_at, ended_at,
      minutes, pause_minutes, notes, change_type, changed_by
    ) VALUES (
      OLD.id, OLD.user_id, OLD.work_date, OLD.started_at, OLD.ended_at,
      OLD.minutes, COALESCE(OLD.pause_minutes, 0), OLD.notes, 'deleted', auth.uid()
    );
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER time_entries_history_trigger
AFTER UPDATE OR DELETE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION log_time_entry_history();

-- Now migrate pause information from notes to pause_minutes column
UPDATE time_entries
SET 
  pause_minutes = CAST(
    COALESCE(
      substring(notes from 'Pause:\s*(\d+)\s*Min'),
      '0'
    ) AS INTEGER
  ),
  notes = CASE 
    WHEN notes ~ 'Pause:\s*\d+\s*Min' 
    THEN trim(regexp_replace(notes, 'Pause:\s*\d+\s*Min,?\s*', '', 'g'))
    ELSE notes
  END
WHERE 
  notes IS NOT NULL
  AND notes LIKE '%Pause:%Min%'
  AND (pause_minutes IS NULL OR pause_minutes = 0);