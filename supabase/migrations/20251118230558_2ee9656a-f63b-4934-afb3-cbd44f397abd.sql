-- 1. Add pause_minutes column to time_entries
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS pause_minutes integer DEFAULT 0 CHECK (pause_minutes >= 0);

-- 2. Create time_entry_history table for version tracking
CREATE TABLE IF NOT EXISTS public.time_entry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  minutes integer NOT NULL,
  pause_minutes integer DEFAULT 0,
  notes text,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  change_type text NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_time_entry_history_entry ON public.time_entry_history(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_history_date ON public.time_entry_history(changed_at);

-- RLS for time_entry_history
ALTER TABLE public.time_entry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entry history"
ON public.time_entry_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.time_entries te
    WHERE te.id = time_entry_history.time_entry_id
    AND te.user_id = auth.uid()
  )
);

-- Trigger for automatic version history
CREATE OR REPLACE FUNCTION log_time_entry_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.time_entry_history (
      time_entry_id, work_date, started_at, ended_at, 
      minutes, pause_minutes, notes, changed_by, change_type
    ) VALUES (
      OLD.id, OLD.work_date, OLD.started_at, OLD.ended_at,
      OLD.minutes, COALESCE(OLD.pause_minutes, 0), OLD.notes, 
      auth.uid(), 'updated'
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_entry_history (
      time_entry_id, work_date, started_at, ended_at, 
      minutes, pause_minutes, notes, changed_by, change_type
    ) VALUES (
      OLD.id, OLD.work_date, OLD.started_at, OLD.ended_at,
      OLD.minutes, COALESCE(OLD.pause_minutes, 0), OLD.notes, 
      auth.uid(), 'deleted'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_time_entry_changes ON public.time_entries;
CREATE TRIGGER trg_time_entry_changes
AFTER UPDATE OR DELETE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION log_time_entry_change();

-- 3. Extend sick_days table with end_date and status
ALTER TABLE public.sick_days
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Update existing sick_days entries
UPDATE public.sick_days SET end_date = sick_date WHERE end_date IS NULL;

-- Now make end_date NOT NULL
ALTER TABLE public.sick_days ALTER COLUMN end_date SET NOT NULL;

-- Add constraint for status
ALTER TABLE public.sick_days 
  DROP CONSTRAINT IF EXISTS sick_days_status_check;
ALTER TABLE public.sick_days 
  ADD CONSTRAINT sick_days_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_sick_days_date_range ON public.sick_days(sick_date, end_date);

-- 4. Create public_holidays table
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL,
  state_code text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public.public_holidays(holiday_date);

-- RLS for public_holidays
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view holidays"
ON public.public_holidays FOR SELECT
USING (true);

CREATE POLICY "Admins can manage holidays"
ON public.public_holidays FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'abgeordneter'
  )
);

-- Insert German holidays for 2025 (bundesweit)
INSERT INTO public.public_holidays (holiday_date, name, state_code) VALUES
  ('2025-01-01', 'Neujahr', 'ALL'),
  ('2025-04-18', 'Karfreitag', 'ALL'),
  ('2025-04-21', 'Ostermontag', 'ALL'),
  ('2025-05-01', 'Tag der Arbeit', 'ALL'),
  ('2025-05-29', 'Christi Himmelfahrt', 'ALL'),
  ('2025-06-09', 'Pfingstmontag', 'ALL'),
  ('2025-10-03', 'Tag der Deutschen Einheit', 'ALL'),
  ('2025-12-25', 'Erster Weihnachtsfeiertag', 'ALL'),
  ('2025-12-26', 'Zweiter Weihnachtsfeiertag', 'ALL')
ON CONFLICT DO NOTHING;