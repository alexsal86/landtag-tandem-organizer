-- Update birthday appointments to be all-day events
UPDATE appointments 
SET is_all_day = true 
WHERE category = 'birthday' AND is_all_day = false;

-- Update handle_contact_birthday_change function to create all-day birthday events
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
        -- Create new birthday appointment as all-day event
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
          (birthday_date + interval '1 day')::timestamp with time zone,
          NEW.name || ' - Geburtstag',
          'Geburtstag von ' || NEW.name,
          'birthday',
          'medium',
          'planned',
          1440,
          true
        );
      ELSE
        -- Update existing birthday appointment as all-day event
        UPDATE public.appointments
        SET 
          start_time = birthday_date::timestamp with time zone,
          end_time = (birthday_date + interval '1 day')::timestamp with time zone,
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
    
    -- Create birthday appointment as all-day event
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
      (birthday_date + interval '1 day')::timestamp with time zone,
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