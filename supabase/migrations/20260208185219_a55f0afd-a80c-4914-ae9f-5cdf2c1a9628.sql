
-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function to automatically send push notifications after notification insert
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  push_enabled_var boolean;
  has_subscriptions boolean;
BEGIN
  -- Check if user has push enabled for this notification type
  SELECT uns.push_enabled INTO push_enabled_var
  FROM public.user_notification_settings uns
  WHERE uns.user_id = NEW.user_id 
    AND uns.notification_type_id = NEW.notification_type_id;
  
  -- If no settings found or push not enabled, skip
  IF push_enabled_var IS NULL OR push_enabled_var = false THEN
    RETURN NEW;
  END IF;
  
  -- Check if user has any active push subscriptions (avoid unnecessary HTTP calls)
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions 
    WHERE user_id = NEW.user_id AND is_active = true
  ) INTO has_subscriptions;
  
  IF NOT has_subscriptions THEN
    RETURN NEW;
  END IF;
  
  -- Call the send-push-notification edge function via pg_net
  -- This is async (non-blocking) so it won't slow down the INSERT
  PERFORM net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50"}'::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'data', COALESCE(NEW.data, '{}'::jsonb),
      'priority', COALESCE(NEW.priority, 'medium'),
      'from_trigger', true
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on notifications table (AFTER INSERT so the notification row exists first)
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
CREATE TRIGGER push_notification_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();
