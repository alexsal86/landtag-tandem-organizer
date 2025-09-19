-- Update the birthday sync function to create recurring appointments
CREATE OR REPLACE FUNCTION public.sync_birthday_appointments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      SELECT id, user_id, name, birthday, tenant_id
      FROM public.contacts 
      WHERE birthday IS NOT NULL 
      AND user_id = user_record.user_id
    LOOP
      -- Calculate this year's birthday date
      birthday_date := make_date(current_year, EXTRACT(MONTH FROM contact_record.birthday)::int, EXTRACT(DAY FROM contact_record.birthday)::int);
      
      -- Check if birthday appointment already exists
      SELECT id INTO appointment_id
      FROM public.appointments
      WHERE contact_id = contact_record.id
      AND category = 'birthday'
      LIMIT 1;
      
      IF appointment_id IS NULL THEN
        -- Create new recurring birthday appointment
        INSERT INTO public.appointments (
          user_id,
          contact_id,
          tenant_id,
          start_time,
          end_time,
          title,
          description,
          category,
          priority,
          status,
          reminder_minutes,
          is_all_day,
          recurrence_rule,
          recurrence_end_date
        ) VALUES (
          contact_record.user_id,
          contact_record.id,
          contact_record.tenant_id,
          birthday_date::timestamp with time zone,
          (birthday_date + interval '1 day')::timestamp with time zone,
          contact_record.name || ' - Geburtstag',
          'Geburtstag von ' || contact_record.name,
          'birthday',
          'medium',
          'planned',
          1440, -- 24 hours reminder
          true, -- all day event
          'FREQ=YEARLY', -- yearly recurrence
          NULL -- no end date (recurring forever)
        );
      ELSE
        -- Update existing birthday appointment to be recurring
        UPDATE public.appointments
        SET 
          start_time = birthday_date::timestamp with time zone,
          end_time = (birthday_date + interval '1 day')::timestamp with time zone,
          title = contact_record.name || ' - Geburtstag',
          description = 'Geburtstag von ' || contact_record.name,
          is_all_day = true,
          recurrence_rule = 'FREQ=YEARLY',
          recurrence_end_date = NULL,
          updated_at = now()
        WHERE id = appointment_id;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- Create trigger function for when contacts are updated
CREATE OR REPLACE FUNCTION public.handle_contact_birthday_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  appointment_id uuid;
  current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  birthday_date date;
BEGIN
  -- Handle birthday changes
  IF NEW.birthday IS DISTINCT FROM OLD.birthday THEN
    
    -- Find existing birthday appointment
    SELECT id INTO appointment_id
    FROM public.appointments
    WHERE contact_id = NEW.id
    AND category = 'birthday'
    LIMIT 1;
    
    IF NEW.birthday IS NULL THEN
      -- Remove birthday appointment if birthday was deleted
      IF appointment_id IS NOT NULL THEN
        DELETE FROM public.appointments WHERE id = appointment_id;
      END IF;
    ELSE
      -- Calculate this year's birthday date
      birthday_date := make_date(current_year, EXTRACT(MONTH FROM NEW.birthday)::int, EXTRACT(DAY FROM NEW.birthday)::int);
      
      IF appointment_id IS NULL THEN
        -- Create new recurring birthday appointment
        INSERT INTO public.appointments (
          user_id,
          contact_id,
          tenant_id,
          start_time,
          end_time,
          title,
          description,
          category,
          priority,
          status,
          reminder_minutes,
          is_all_day,
          recurrence_rule,
          recurrence_end_date
        ) VALUES (
          NEW.user_id,
          NEW.id,
          NEW.tenant_id,
          birthday_date::timestamp with time zone,
          (birthday_date + interval '1 day')::timestamp with time zone,
          NEW.name || ' - Geburtstag',
          'Geburtstag von ' || NEW.name,
          'birthday',
          'medium',
          'planned',
          1440, -- 24 hours reminder
          true, -- all day event
          'FREQ=YEARLY', -- yearly recurrence
          NULL -- no end date (recurring forever)
        );
      ELSE
        -- Update existing birthday appointment
        UPDATE public.appointments
        SET 
          start_time = birthday_date::timestamp with time zone,
          end_time = (birthday_date + interval '1 day')::timestamp with time zone,
          title = NEW.name || ' - Geburtstag',
          description = 'Geburtstag von ' || NEW.name,
          is_all_day = true,
          recurrence_rule = 'FREQ=YEARLY',
          recurrence_end_date = NULL,
          updated_at = now()
        WHERE id = appointment_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS contact_birthday_sync ON public.contacts;

-- Create trigger for contact updates
CREATE TRIGGER contact_birthday_sync
  AFTER INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_contact_birthday_change();

-- Update all existing birthday appointments to be recurring
UPDATE public.appointments 
SET 
  recurrence_rule = 'FREQ=YEARLY',
  recurrence_end_date = NULL,
  is_all_day = true,
  start_time = make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM start_time)::int, EXTRACT(DAY FROM start_time)::int)::timestamp with time zone,
  end_time = (make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM start_time)::int, EXTRACT(DAY FROM start_time)::int) + interval '1 day')::timestamp with time zone,
  updated_at = now()
WHERE category = 'birthday' AND recurrence_rule IS NULL;

-- Run the sync function to ensure all existing contacts with birthdays have appointments
SELECT public.sync_birthday_appointments();