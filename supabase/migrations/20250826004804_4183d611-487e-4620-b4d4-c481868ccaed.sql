-- Create trigger to automatically send push notifications when notifications are created
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
BEGIN
  -- Get user's push notification settings
  SELECT 
    uns.push_enabled,
    uns.is_enabled
  INTO user_settings
  FROM public.user_notification_settings uns
  INNER JOIN public.notification_types nt ON nt.id = uns.notification_type_id
  WHERE uns.user_id = NEW.user_id 
  AND nt.id = NEW.notification_type_id;
  
  -- If user has push notifications enabled for this type, send push notification
  IF user_settings.push_enabled = true AND user_settings.is_enabled = true THEN
    -- Call the edge function to send push notification
    PERFORM net.http_post(
      url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'priority', NEW.priority,
        'data', NEW.data
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on notifications table
DROP TRIGGER IF EXISTS notification_push_trigger ON public.notifications;
CREATE TRIGGER notification_push_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_notification_push();

-- Create triggers for task and message notifications
DROP TRIGGER IF EXISTS task_notification_trigger ON public.tasks;
CREATE TRIGGER task_notification_trigger
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_notifications();

DROP TRIGGER IF EXISTS message_notification_trigger ON public.messages;
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_notifications();

DROP TRIGGER IF EXISTS message_recipient_notification_trigger ON public.message_recipients;
CREATE TRIGGER message_recipient_notification_trigger
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_recipient_notifications();