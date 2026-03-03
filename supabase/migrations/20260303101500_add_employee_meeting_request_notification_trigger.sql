-- Notify responsible admin when an employee creates a pending meeting request
CREATE OR REPLACE FUNCTION public.handle_employee_meeting_request_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_admin_id UUID;
  employee_display_name TEXT;
BEGIN
  -- Only notify for newly created pending requests
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Resolve the responsible admin for the employee
  SELECT es.admin_id
  INTO target_admin_id
  FROM public.employee_settings es
  WHERE es.user_id = NEW.employee_id
  LIMIT 1;

  -- If no admin is assigned, skip notification
  IF target_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Optional employee display name
  SELECT p.display_name
  INTO employee_display_name
  FROM public.profiles p
  WHERE p.user_id = NEW.employee_id
  LIMIT 1;

  PERFORM public.create_notification(
    target_admin_id,
    'employee_meeting_requested',
    'Gesprächswunsch von ' || COALESCE(employee_display_name, 'Mitarbeiter:in'),
    COALESCE(employee_display_name, 'Ein:e Mitarbeiter:in') || ' hat ein Mitarbeitergespräch angefragt.',
    jsonb_build_object(
      'request_id', NEW.id,
      'employee_id', NEW.employee_id,
      'urgency', NEW.urgency,
      'reason', NEW.reason
    ),
    CASE NEW.urgency
      WHEN 'high' THEN 'high'
      WHEN 'low' THEN 'low'
      ELSE 'medium'
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_employee_meeting_request_notifications ON public.employee_meeting_requests;
CREATE TRIGGER trigger_employee_meeting_request_notifications
AFTER INSERT ON public.employee_meeting_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_employee_meeting_request_notifications();
