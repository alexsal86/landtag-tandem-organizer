-- Create notification types for leave requests
INSERT INTO public.notification_types (name, label, description, is_active)
VALUES 
  ('vacation_request_pending', 'Urlaubsantrag eingereicht', 'Benachrichtigung bei neuem Urlaubsantrag', true),
  ('sick_leave_request_pending', 'Krankmeldung eingereicht', 'Benachrichtigung bei neuer Krankmeldung', true);

-- Map notification types to navigation context "time"
INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
VALUES 
  ('vacation_request_pending', 'time'),
  ('sick_leave_request_pending', 'time');

-- Create trigger function for leave request notifications
CREATE OR REPLACE FUNCTION public.handle_leave_request_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  admin_user_id UUID;
  requester_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Only execute on INSERT with status='pending'
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    
    -- Get admin_id from employee_settings
    SELECT admin_id INTO admin_user_id
    FROM public.employee_settings
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    -- If no admin found, skip notification
    IF admin_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get requester's name
    SELECT display_name INTO requester_name
    FROM public.profiles
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    requester_name := COALESCE(requester_name, 'Ein Mitarbeiter');
    
    -- Set notification type, title and message based on leave type
    IF NEW.type = 'vacation' THEN
      notification_type := 'vacation_request_pending';
      notification_title := 'Neuer Urlaubsantrag';
      notification_message := requester_name || ' hat einen Urlaubsantrag vom ' || 
                             TO_CHAR(NEW.start_date, 'DD.MM.YYYY') || ' bis ' || 
                             TO_CHAR(NEW.end_date, 'DD.MM.YYYY') || ' eingereicht.';
    ELSIF NEW.type = 'sick' THEN
      notification_type := 'sick_leave_request_pending';
      notification_title := 'Neue Krankmeldung';
      notification_message := requester_name || ' hat sich vom ' || 
                             TO_CHAR(NEW.start_date, 'DD.MM.YYYY') || ' bis ' || 
                             TO_CHAR(NEW.end_date, 'DD.MM.YYYY') || ' krankgemeldet.';
    ELSE
      -- For "other" type use vacation_request_pending
      notification_type := 'vacation_request_pending';
      notification_title := 'Neuer Abwesenheitsantrag';
      notification_message := requester_name || ' hat einen Abwesenheitsantrag vom ' || 
                             TO_CHAR(NEW.start_date, 'DD.MM.YYYY') || ' bis ' || 
                             TO_CHAR(NEW.end_date, 'DD.MM.YYYY') || ' eingereicht.';
    END IF;
    
    -- Send notification to admin
    PERFORM public.create_notification(
      admin_user_id,
      notification_type,
      notification_title,
      notification_message,
      jsonb_build_object(
        'leave_request_id', NEW.id,
        'user_id', NEW.user_id,
        'user_name', requester_name,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'type', NEW.type
      ),
      'high'
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on leave_requests table
DROP TRIGGER IF EXISTS trigger_leave_request_notifications ON public.leave_requests;

CREATE TRIGGER trigger_leave_request_notifications
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_request_notifications();