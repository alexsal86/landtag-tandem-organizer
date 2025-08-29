-- Fix Alexander Salomon's birthday to be a single day event
UPDATE appointments 
SET end_time = start_time + interval '23 hours 59 minutes'
WHERE id = '217b9c0c-a885-4a26-b977-9b8a4f3d806b';

-- Update the birthday function to create proper single-day birthday events
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
        -- Create new birthday appointment as single-day all-day event
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
          reminder_minutes,
          is_all_day
        ) VALUES (
          NEW.user_id,
          NEW.id,
          birthday_date::timestamp with time zone,
          (birthday_date::timestamp with time zone + interval '23 hours 59 minutes'),
          NEW.name || ' - Geburtstag',
          'Geburtstag von ' || NEW.name,
          'birthday',
          'medium',
          'planned',
          1440,
          true
        );
      ELSE
        -- Update existing birthday appointment as single-day all-day event
        UPDATE public.appointments
        SET 
          start_time = birthday_date::timestamp with time zone,
          end_time = (birthday_date::timestamp with time zone + interval '23 hours 59 minutes'),
          title = NEW.name || ' - Geburtstag',
          description = 'Geburtstag von ' || NEW.name,
          is_all_day = true,
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
    
    -- Create birthday appointment as single-day all-day event
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
      reminder_minutes,
      is_all_day
    ) VALUES (
      NEW.user_id,
      NEW.id,
      birthday_date::timestamp with time zone,
      (birthday_date::timestamp with time zone + interval '23 hours 59 minutes'),
      NEW.name || ' - Geburtstag',
      'Geburtstag von ' || NEW.name,
      'birthday',
      'medium',
      'planned',
      1440,
      true
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