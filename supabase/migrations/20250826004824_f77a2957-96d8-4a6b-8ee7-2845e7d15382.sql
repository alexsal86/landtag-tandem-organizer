-- Fix the security issue by adding SET search_path to the function
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    -- Call the edge function to send push notification asynchronously
    PERFORM pg_notify('push_notification', jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', NEW.priority,
      'data', NEW.data
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;