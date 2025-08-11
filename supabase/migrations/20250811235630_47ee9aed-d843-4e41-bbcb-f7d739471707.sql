-- Add contact_id field to appointments table for linking birthday appointments to contacts
ALTER TABLE public.appointments 
ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Update the category check constraint to include 'birthday'
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_category_check;

ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_category_check 
CHECK (category IN ('meeting', 'appointment', 'deadline', 'personal', 'birthday'));

-- Create function to sync birthday appointments
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
  FOR user_record IN SELECT DISTINCT user_id FROM contacts WHERE birthday IS NOT NULL
  LOOP
    -- Process each contact with a birthday for this user
    FOR contact_record IN 
      SELECT id, user_id, name, birthday 
      FROM contacts 
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
      FROM appointments
      WHERE contact_id = contact_record.id
      AND category = 'birthday'
      LIMIT 1;
      
      IF appointment_id IS NULL THEN
        -- Create new birthday appointment
        INSERT INTO appointments (
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
        UPDATE appointments
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

-- Create function to handle individual contact birthday updates
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
      DELETE FROM appointments
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
      FROM appointments
      WHERE contact_id = NEW.id AND category = 'birthday'
      LIMIT 1;
      
      IF appointment_id IS NULL THEN
        -- Create new birthday appointment
        INSERT INTO appointments (
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
        UPDATE appointments
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
    INSERT INTO appointments (
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
    DELETE FROM appointments
    WHERE contact_id = OLD.id AND category = 'birthday';
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for automatic birthday sync
CREATE TRIGGER trigger_contact_birthday_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_contact_birthday_change();

-- Sync existing birthdays
SELECT public.sync_birthday_appointments();