-- Fix notify_team_on_feedback trigger to support external events
CREATE OR REPLACE FUNCTION public.notify_team_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
  appointment_title TEXT;
  event_id UUID;
BEGIN
  -- Send notification to team members when feedback is completed
  IF NEW.feedback_status = 'completed' AND (OLD.feedback_status IS NULL OR OLD.feedback_status = 'pending') THEN
    
    -- Get title - either from appointment or external event
    IF NEW.appointment_id IS NOT NULL THEN
      SELECT title INTO appointment_title FROM public.appointments WHERE id = NEW.appointment_id;
      event_id := NEW.appointment_id;
    ELSIF NEW.external_event_id IS NOT NULL THEN
      SELECT title INTO appointment_title FROM public.external_events WHERE id = NEW.external_event_id;
      event_id := NEW.external_event_id;
    END IF;
    
    -- Only create notification if title is available
    IF appointment_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, notification_type_id, title, message, data, priority, navigation_context)
      SELECT 
        utm.user_id,
        nt.id,
        'Neues Termin-Feedback',
        'Feedback zu Termin verfügbar: ' || appointment_title,
        jsonb_build_object(
          'feedback_id', NEW.id,
          'appointment_id', NEW.appointment_id,
          'external_event_id', NEW.external_event_id,
          'appointment_title', appointment_title
        ),
        'medium',
        'calendar'
      FROM public.user_tenant_memberships utm
      CROSS JOIN public.notification_types nt
      WHERE utm.tenant_id = NEW.tenant_id
        AND utm.user_id != NEW.user_id
        AND utm.is_active = true
        AND nt.name = 'appointment_reminder'
        AND nt.is_active = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;