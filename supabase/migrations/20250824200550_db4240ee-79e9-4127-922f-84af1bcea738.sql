-- Phase 1: Fix Basic Notifications

-- 1. Update task notification function to create notifications for ALL tasks, not just assigned ones
CREATE OR REPLACE FUNCTION public.handle_task_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Task created notification
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'task_created',
      'Neue Aufgabe erstellt',
      'Die Aufgabe "' || NEW.title || '" wurde erstellt.',
      jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title),
      CASE NEW.priority 
        WHEN 'high' THEN 'high' 
        WHEN 'urgent' THEN 'urgent' 
        ELSE 'medium' 
      END
    );

    -- Additional notification if assigned to someone
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != '' THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'task_assigned',
        'Aufgabe zugewiesen',
        'Ihnen wurde die Aufgabe "' || NEW.title || '" zugewiesen an: ' || NEW.assigned_to,
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'assigned_to', NEW.assigned_to),
        CASE NEW.priority 
          WHEN 'high' THEN 'high' 
          WHEN 'urgent' THEN 'urgent' 
          ELSE 'medium' 
        END
      );
    END IF;
  END IF;

  -- Task updated notification (only for status changes or priority changes)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'task_updated',
        'Aufgabenstatus geändert',
        'Aufgabe "' || NEW.title || '" Status geändert von "' || OLD.status || '" zu "' || NEW.status || '".',
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status),
        'medium'
      );
    END IF;

    IF NEW.priority != OLD.priority THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'task_updated',
        'Aufgabenpriorität geändert',
        'Aufgabe "' || NEW.title || '" Priorität geändert von "' || OLD.priority || '" zu "' || NEW.priority || '".',
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'old_priority', OLD.priority, 'new_priority', NEW.priority),
        CASE NEW.priority 
          WHEN 'high' THEN 'high' 
          WHEN 'urgent' THEN 'urgent' 
          ELSE 'medium' 
        END
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. Create message notification trigger
CREATE OR REPLACE FUNCTION public.handle_message_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Message created notification
  IF TG_OP = 'INSERT' THEN
    -- For messages to all users, create notifications for all users except author
    IF NEW.is_for_all_users = true THEN
      INSERT INTO public.notifications (user_id, notification_type_id, title, message, data, priority)
      SELECT 
        p.user_id,
        nt.id,
        'Neue Nachricht für alle',
        'Neue Nachricht: "' || NEW.title || '"',
        jsonb_build_object('message_id', NEW.id, 'message_title', NEW.title, 'author_id', NEW.author_id),
        'medium'
      FROM public.profiles p
      CROSS JOIN public.notification_types nt
      WHERE p.user_id != NEW.author_id 
      AND nt.name = 'message_received'
      AND nt.is_active = true;
    ELSE
      -- For targeted messages, notifications will be created when recipients are added
      -- This happens in the message_recipients table insert
      NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the message notification trigger
DROP TRIGGER IF EXISTS message_notifications_trigger ON public.messages;
CREATE TRIGGER message_notifications_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_notifications();

-- 3. Create message recipient notification trigger
CREATE OR REPLACE FUNCTION public.handle_message_recipient_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  msg_record RECORD;
BEGIN
  -- Message recipient added notification
  IF TG_OP = 'INSERT' THEN
    -- Get message details
    SELECT * INTO msg_record FROM public.messages WHERE id = NEW.message_id;
    
    IF msg_record.is_for_all_users = false THEN
      PERFORM public.create_notification(
        NEW.recipient_id,
        'message_received',
        'Neue Nachricht erhalten',
        'Sie haben eine neue Nachricht: "' || msg_record.title || '"',
        jsonb_build_object('message_id', NEW.message_id, 'message_title', msg_record.title, 'author_id', msg_record.author_id),
        'medium'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the message recipient notification trigger
DROP TRIGGER IF EXISTS message_recipient_notifications_trigger ON public.message_recipients;
CREATE TRIGGER message_recipient_notifications_trigger
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_recipient_notifications();

-- 4. Enable real-time updates for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;