-- Address linter: set search_path for newly created functions

CREATE OR REPLACE FUNCTION public._meeting_default_start(_date date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT make_timestamptz(EXTRACT(YEAR FROM _date)::int,
                          EXTRACT(MONTH FROM _date)::int,
                          EXTRACT(DAY FROM _date)::int,
                          10, 0, 0, 'Europe/Berlin');
$$;

CREATE OR REPLACE FUNCTION public._meeting_default_end(_date date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT make_timestamptz(EXTRACT(YEAR FROM _date)::int,
                          EXTRACT(MONTH FROM _date)::int,
                          EXTRACT(DAY FROM _date)::int,
                          11, 0, 0, 'Europe/Berlin');
$$;

CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.handle_meeting_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
$$;