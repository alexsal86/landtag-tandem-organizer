-- Add meeting linkage and agenda hierarchy, plus triggers to sync with appointments and seed default agenda

-- 1) Add meeting_id to appointments to link calendar entries to meetings
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS meeting_id uuid;

-- Add FK and unique index for 1:1 mapping (nullable allowed)
DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_meeting_fk
    FOREIGN KEY (meeting_id)
    REFERENCES public.meetings(id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_meeting_unique
  ON public.appointments(meeting_id)
  WHERE meeting_id IS NOT NULL;

-- 2) Add parent_id to meeting_agenda_items to support subpoints
ALTER TABLE public.meeting_agenda_items
  ADD COLUMN IF NOT EXISTS parent_id uuid;

DO $$ BEGIN
  ALTER TABLE public.meeting_agenda_items
    ADD CONSTRAINT meeting_agenda_items_parent_fk
    FOREIGN KEY (parent_id)
    REFERENCES public.meeting_agenda_items(id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_parent
  ON public.meeting_agenda_items(parent_id);

-- 3) Trigger functions to sync meetings with appointments and seed default agenda

-- Helper to build timestamptz at 10:00 and 11:00 local time based on meeting_date
CREATE OR REPLACE FUNCTION public._meeting_default_start(_date date)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT make_timestamptz(EXTRACT(YEAR FROM _date)::int,
                          EXTRACT(MONTH FROM _date)::int,
                          EXTRACT(DAY FROM _date)::int,
                          10, 0, 0, 'Europe/Berlin');
$$;

CREATE OR REPLACE FUNCTION public._meeting_default_end(_date date)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT make_timestamptz(EXTRACT(YEAR FROM _date)::int,
                          EXTRACT(MONTH FROM _date)::int,
                          EXTRACT(DAY FROM _date)::int,
                          11, 0, 0, 'Europe/Berlin');
$$;

-- Seed default agenda on meeting insert and create linked appointment
CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
RETURNS trigger AS $$
BEGIN
  -- Create or upsert a linked appointment
  INSERT INTO public.appointments (
    user_id, start_time, end_time, title, description, category, status, priority, meeting_id
  ) VALUES (
    NEW.user_id,
    public._meeting_default_start(NEW.meeting_date),
    public._meeting_default_end(NEW.meeting_date),
    NEW.title,
    NEW.description,
    'meeting',
    NEW.status,
    'medium',
    NEW.id
  )
  ON CONFLICT (meeting_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    updated_at = now();

  -- Seed default agenda items if this meeting has none yet
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_agenda_items mai WHERE mai.meeting_id = NEW.id
  ) THEN
    INSERT INTO public.meeting_agenda_items (
      meeting_id, title, description, is_completed, is_recurring, order_index
    ) VALUES
      (NEW.id, 'Begrüßung', NULL, false, false, 0),
      (NEW.id, 'Aktuelles aus dem Landtag', NULL, false, false, 1),
      (NEW.id, 'Politische Schwerpunktthemen & Projekte', NULL, false, false, 2),
      (NEW.id, 'Wahlkreisarbeit', NULL, false, false, 3),
      (NEW.id, 'Kommunikation & Öffentlichkeitsarbeit', NULL, false, false, 4),
      (NEW.id, 'Organisation & Bürointerna', NULL, false, false, 5),
      (NEW.id, 'Verschiedenes', NULL, false, false, 6);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Keep appointment in sync on updates
CREATE OR REPLACE FUNCTION public.handle_meeting_update()
RETURNS trigger AS $$
BEGIN
  -- Update or create the linked appointment
  INSERT INTO public.appointments (
    user_id, start_time, end_time, title, description, category, status, priority, meeting_id
  ) VALUES (
    NEW.user_id,
    public._meeting_default_start(NEW.meeting_date),
    public._meeting_default_end(NEW.meeting_date),
    NEW.title,
    NEW.description,
    'meeting',
    NEW.status,
    'medium',
    NEW.id
  )
  ON CONFLICT (meeting_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trg_meetings_after_insert ON public.meetings;
CREATE TRIGGER trg_meetings_after_insert
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.handle_meeting_insert();

DROP TRIGGER IF EXISTS trg_meetings_after_update ON public.meetings;
CREATE TRIGGER trg_meetings_after_update
AFTER UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.handle_meeting_update();
