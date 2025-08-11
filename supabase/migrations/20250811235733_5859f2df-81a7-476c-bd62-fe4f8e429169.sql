-- Fix security warnings by updating function search paths

-- Update sync_birthday_appointments function
CREATE OR REPLACE FUNCTION public.sync_birthday_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  contact_record RECORD;
  appointment_id uuid;
  current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  birthday_date date;
  user_record RECORD;
BEGIN
  -- Get all users to sync their contacts
  FOR user_record IN SELECT DISTINCT user_id FROM public.contacts WHERE birthday IS NOT NULL
  LOOP
    -- Process each contact with a birthday for this user
    FOR contact_record IN 
      SELECT id, user_id, name, birthday 
      FROM public.contacts 
      WHERE birthday IS NOT NULL 
      AND user_id = user_record.user_id
    LOOP
      -- Calculate this year's birthday date
      birthday_date := make_date(current_year, EXTRACT(MONTH FROM contact_record.birthday)::int, EXTRACT(DAY FROM contact_record.birthday)::int);
      
      -- If birthday has passed this year, set for next year
      IF birthday_date < CURRENT_DATE THEN
        birthday_date := make_date(current_year + 1, EXTRACT(MONTH FROM contact_record.birthday)::int, EXTRACT(DAY FROM contact_record.birthday)::int);
      END IF;
      
      -- Check if birthday appointment already exists
      SELECT id INTO appointment_id
      FROM public.appointments
      WHERE contact_id = contact_record.id
      AND category = 'birthday'
      LIMIT 1;
      
      IF appointment_id IS NULL THEN
        -- Create new birthday appointment
        INSERT INTO public.appointments (
          user_id,
          contact_id,
          start_time,
          end_time,
          title,
          description,
          category,
          priority,
          status,
          reminder_minutes
        ) VALUES (
          contact_record.user_id,
          contact_record.id,
          birthday_date::timestamp with time zone,
          (birthday_date + interval '1 day')::timestamp with time zone,
          contact_record.name || ' - Geburtstag',
          'Geburtstag von ' || contact_record.name,
          'birthday',
          'medium',
          'planned',
          1440 -- 24 hours reminder
        );
      ELSE
        -- Update existing birthday appointment
        UPDATE public.appointments
        SET 
          start_time = birthday_date::timestamp with time zone,
          end_time = (birthday_date + interval '1 day')::timestamp with time zone,
          title = contact_record.name || ' - Geburtstag',
          description = 'Geburtstag von ' || contact_record.name,
          updated_at = now()
        WHERE id = appointment_id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Update handle_contact_birthday_change function
CREATE OR REPLACE FUNCTION public.handle_contact_birthday_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  appointment_id uuid;
  current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  birthday_date date;
BEGIN
  -- Handle UPDATE case
  IF TG_OP = 'UPDATE' THEN
    -- If birthday was removed, delete the appointment
    IF OLD.birthday IS NOT NULL AND NEW.birthday IS NULL THEN
      DELETE FROM public.appointments
      WHERE contact_id = OLD.id AND category = 'birthday';
      RETURN NEW;
    END IF;
    
    -- If birthday was added or changed
    IF NEW.birthday IS NOT NULL AND (OLD.birthday IS NULL OR OLD.birthday != NEW.birthday OR OLD.name != NEW.name) THEN
      -- Calculate this year's birthday date
      birthday_date := make_date(current_year, EXTRACT(MONTH FROM NEW.birthday)::int, EXTRACT(DAY FROM NEW.birthday)::int);
      
      -- If birthday has passed this year, set for next year
      IF birthday_date < CURRENT_DATE THEN
        birthday_date := make_date(current_year + 1, EXTRACT(MONTH FROM NEW.birthday)::int, EXTRACT(DAY FROM NEW.birthday)::int);
      END IF;
      
      -- Check if birthday appointment exists
      SELECT id INTO appointment_id
      FROM public.appointments
      WHERE contact_id = NEW.id AND category = 'birthday'
      LIMIT 1;
      
      IF appointment_id IS NULL THEN
        -- Create new birthday appointment
        INSERT INTO public.appointments (
          user_id,
          contact_id,
          start_time,
          end_time,
          title,
          description,
          category,
          priority,
          status,
          reminder_minutes
        ) VALUES (
          NEW.user_id,
          NEW.id,
          birthday_date::timestamp with time zone,
          (birthday_date + interval '1 day')::timestamp with time zone,
          NEW.name || ' - Geburtstag',
          'Geburtstag von ' || NEW.name,
          'birthday',
          'medium',
          'planned',
          1440
        );
      ELSE
        -- Update existing birthday appointment
        UPDATE public.appointments
        SET 
          start_time = birthday_date::timestamp with time zone,
          end_time = (birthday_date + interval '1 day')::timestamp with time zone,
          title = NEW.name || ' - Geburtstag',
          description = 'Geburtstag von ' || NEW.name,
          updated_at = now()
        WHERE id = appointment_id;
      END IF;
    END IF;
  END IF;
  
  -- Handle INSERT case
  IF TG_OP = 'INSERT' AND NEW.birthday IS NOT NULL THEN
    -- Calculate this year's birthday date
    birthday_date := make_date(current_year, EXTRACT(MONTH FROM NEW.birthday)::int, EXTRACT(DAY FROM NEW.birthday)::int);
    
    -- If birthday has passed this year, set for next year
    IF birthday_date < CURRENT_DATE THEN
      birthday_date := make_date(current_year + 1, EXTRACT(MONTH FROM NEW.birthday)::int, EXTRACT(DAY FROM NEW.birthday)::int);
    END IF;
    
    -- Create birthday appointment
    INSERT INTO public.appointments (
      user_id,
      contact_id,
      start_time,
      end_time,
      title,
      description,
      category,
      priority,
      status,
      reminder_minutes
    ) VALUES (
      NEW.user_id,
      NEW.id,
      birthday_date::timestamp with time zone,
      (birthday_date + interval '1 day')::timestamp with time zone,
      NEW.name || ' - Geburtstag',
      'Geburtstag von ' || NEW.name,
      'birthday',
      'medium',
      'planned',
      1440
    );
  END IF;
  
  -- Handle DELETE case
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.appointments
    WHERE contact_id = OLD.id AND category = 'birthday';
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;