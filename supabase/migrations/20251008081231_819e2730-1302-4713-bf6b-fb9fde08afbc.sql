-- Add automatic activity logging for call logs
CREATE OR REPLACE FUNCTION public.log_call_log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_tenant_id UUID;
BEGIN
  -- Get tenant_id from the contact
  IF NEW.contact_id IS NOT NULL THEN
    SELECT tenant_id INTO contact_tenant_id
    FROM contacts
    WHERE id = NEW.contact_id;
    
    -- Only log if we have a valid tenant and authenticated user
    IF contact_tenant_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
      INSERT INTO public.contact_activities (
        contact_id,
        tenant_id,
        activity_type,
        title,
        description,
        created_by,
        metadata
      ) VALUES (
        NEW.contact_id,
        contact_tenant_id,
        'call',
        CASE 
          WHEN NEW.call_type = 'incoming' THEN 'Eingehender Anruf'
          WHEN NEW.call_type = 'outgoing' THEN 'Ausgehender Anruf'
          WHEN NEW.call_type = 'missed' THEN 'Verpasster Anruf'
          ELSE 'Anruf'
        END,
        CASE 
          WHEN NEW.notes IS NOT NULL AND NEW.notes != '' THEN NEW.notes
          WHEN NEW.duration_minutes IS NOT NULL THEN 'Dauer: ' || NEW.duration_minutes::text || ' Minuten'
          ELSE NULL
        END,
        auth.uid(),
        jsonb_build_object(
          'call_type', NEW.call_type,
          'duration_minutes', NEW.duration_minutes,
          'call_log_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for call log creation
DROP TRIGGER IF EXISTS trigger_log_call_log_activity ON public.call_logs;
CREATE TRIGGER trigger_log_call_log_activity
  AFTER INSERT ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_call_log_activity();

-- Add automatic activity logging for appointments with contacts
CREATE OR REPLACE FUNCTION public.log_appointment_contact_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_record RECORD;
  contact_tenant_id UUID;
BEGIN
  -- Get appointment details
  SELECT * INTO appointment_record
  FROM appointments
  WHERE id = NEW.appointment_id;
  
  -- Get tenant_id from the contact
  SELECT tenant_id INTO contact_tenant_id
  FROM contacts
  WHERE id = NEW.contact_id;
  
  -- Only log if we have valid data and authenticated user
  IF appointment_record.id IS NOT NULL AND contact_tenant_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.contact_activities (
      contact_id,
      tenant_id,
      activity_type,
      title,
      description,
      created_by,
      metadata
    ) VALUES (
      NEW.contact_id,
      contact_tenant_id,
      'appointment',
      'Termin geplant: ' || appointment_record.title,
      CASE 
        WHEN appointment_record.description IS NOT NULL AND appointment_record.description != '' 
        THEN appointment_record.description
        ELSE 'Termin am ' || to_char(appointment_record.start_time, 'DD.MM.YYYY HH24:MI') || ' Uhr'
      END,
      auth.uid(),
      jsonb_build_object(
        'appointment_id', NEW.appointment_id,
        'start_time', appointment_record.start_time,
        'end_time', appointment_record.end_time,
        'location', appointment_record.location
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for appointment_contacts creation
DROP TRIGGER IF EXISTS trigger_log_appointment_contact_activity ON public.appointment_contacts;
CREATE TRIGGER trigger_log_appointment_contact_activity
  AFTER INSERT ON public.appointment_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_appointment_contact_activity();