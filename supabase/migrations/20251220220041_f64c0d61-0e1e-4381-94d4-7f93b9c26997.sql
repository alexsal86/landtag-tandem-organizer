-- Funktion zum Erstellen von Benachrichtigungen bei Urlaubsanträgen
CREATE OR REPLACE FUNCTION notify_on_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_record RECORD;
  notification_type_id UUID;
  requester_name TEXT;
  leave_type_label TEXT;
BEGIN
  -- Nur bei neuen Anträgen mit Status 'pending'
  IF NEW.status = 'pending' THEN
    -- Namen des Antragstellers holen
    SELECT display_name INTO requester_name
    FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    
    -- Notification-Type basierend auf Leave-Type
    IF NEW.type = 'vacation' THEN
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'vacation_request_pending' LIMIT 1;
      leave_type_label := 'Urlaubsantrag';
    ELSIF NEW.type = 'sick' THEN
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'sick_leave_request_pending' LIMIT 1;
      leave_type_label := 'Krankmeldung';
    ELSE
      -- Für andere Types allgemein
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'vacation_request_pending' LIMIT 1;
      leave_type_label := 'Antrag';
    END IF;
    
    -- Für alle Admins/Büroleitung eine Benachrichtigung erstellen
    FOR admin_user_record IN 
      SELECT DISTINCT ur.user_id FROM user_roles ur 
      WHERE ur.role IN ('admin', 'bueroleitung')
      AND ur.user_id != NEW.user_id -- Nicht an sich selbst
    LOOP
      INSERT INTO notifications (
        user_id, 
        notification_type_id, 
        title, 
        message, 
        navigation_context,
        data,
        tenant_id
      ) VALUES (
        admin_user_record.user_id,
        notification_type_id,
        leave_type_label || ' von ' || COALESCE(requester_name, 'Mitarbeiter'),
        COALESCE(requester_name, 'Ein Mitarbeiter') || ' hat einen ' || leave_type_label || ' eingereicht (' || 
          TO_CHAR(NEW.start_date, 'DD.MM.YYYY') || ' bis ' || TO_CHAR(NEW.end_date, 'DD.MM.YYYY') || ')',
        'employee',
        jsonb_build_object(
          'leave_request_id', NEW.id,
          'requester_id', NEW.user_id,
          'leave_type', NEW.type,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date
        ),
        NEW.tenant_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger erstellen (falls noch nicht vorhanden)
DROP TRIGGER IF EXISTS leave_request_notification_trigger ON leave_requests;
CREATE TRIGGER leave_request_notification_trigger
AFTER INSERT ON leave_requests
FOR EACH ROW EXECUTE FUNCTION notify_on_leave_request();