-- Add pause_minutes to time_entries if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'time_entries' 
    AND column_name = 'pause_minutes'
  ) THEN
    ALTER TABLE public.time_entries ADD COLUMN pause_minutes INTEGER DEFAULT 0;
  END IF;
END $$;

-- Drop and recreate time_entry_history table
DROP TABLE IF EXISTS public.time_entry_history CASCADE;

CREATE TABLE public.time_entry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  minutes INTEGER,
  pause_minutes INTEGER,
  notes TEXT,
  change_type TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time entry history"
ON public.time_entry_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert time entry history"
ON public.time_entry_history FOR INSERT
WITH CHECK (true);

-- Drop and recreate public_holidays table
DROP TABLE IF EXISTS public.public_holidays CASCADE;

CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_nationwide BOOLEAN DEFAULT true,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public holidays"
ON public.public_holidays FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage holidays"
ON public.public_holidays FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'abgeordneter'
));

-- Create trigger function
CREATE OR REPLACE FUNCTION public.log_time_entry_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.time_entry_history (
      time_entry_id, user_id, entry_date, started_at, ended_at,
      minutes, pause_minutes, notes, change_type, changed_by
    ) VALUES (
      OLD.id, OLD.user_id, OLD.entry_date, OLD.started_at, OLD.ended_at,
      OLD.minutes, OLD.pause_minutes, OLD.notes, 'updated', auth.uid()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_entry_history (
      time_entry_id, user_id, entry_date, started_at, ended_at,
      minutes, pause_minutes, notes, change_type, changed_by
    ) VALUES (
      OLD.id, OLD.user_id, OLD.entry_date, OLD.started_at, OLD.ended_at,
      OLD.minutes, OLD.pause_minutes, OLD.notes, 'deleted', auth.uid()
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS time_entries_history_trigger ON public.time_entries;
CREATE TRIGGER time_entries_history_trigger
AFTER UPDATE OR DELETE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.log_time_entry_changes();

-- Insert German public holidays for 2025
INSERT INTO public.public_holidays (holiday_date, name, is_nationwide) VALUES
  ('2025-01-01', 'Neujahr', true),
  ('2025-04-18', 'Karfreitag', true),
  ('2025-04-21', 'Ostermontag', true),
  ('2025-05-01', 'Tag der Arbeit', true),
  ('2025-05-29', 'Christi Himmelfahrt', true),
  ('2025-06-09', 'Pfingstmontag', true),
  ('2025-10-03', 'Tag der Deutschen Einheit', true),
  ('2025-12-25', 'Erster Weihnachtstag', true),
  ('2025-12-26', 'Zweiter Weihnachtstag', true);