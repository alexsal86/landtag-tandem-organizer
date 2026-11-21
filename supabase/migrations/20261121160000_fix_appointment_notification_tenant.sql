-- Keep legacy callers tenant-scoped using the existing active-membership resolver.
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param uuid,
  type_name text,
  title_param text,
  message_param text,
  data_param jsonb DEFAULT NULL::jsonb,
  priority_param text DEFAULT 'medium'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_tenant uuid;
BEGIN
  resolved_tenant := public.get_user_primary_tenant_id(user_id_param);
  IF resolved_tenant IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.create_notification(
    user_id_param, type_name, title_param, message_param,
    data_param, priority_param, resolved_tenant
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_appointment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Appointment created notification
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'appointment_reminder',
      'Neuer Termin erstellt',
      'Neuer Termin: ' || NEW.title || ' am ' || TO_CHAR(NEW.start_time, 'DD.MM.YYYY HH24:MI'),
      jsonb_build_object('appointment_id', NEW.id, 'start_time', NEW.start_time),
      'medium',
      NEW.tenant_id
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- Both historic trigger names exist on older installations.
DROP TRIGGER IF EXISTS appointment_notifications ON public.appointments;
DROP TRIGGER IF EXISTS appointment_notifications_trigger ON public.appointments;
CREATE TRIGGER appointment_notifications_trigger
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_notifications();
