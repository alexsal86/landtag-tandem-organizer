-- Update the notification push function to call the worker function
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_settings RECORD;
  function_url text;
  service_role_key text;
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
  
  -- If no settings found, assume enabled (default behavior)
  IF user_settings IS NULL THEN
    user_settings.push_enabled := true;
    user_settings.is_enabled := true;
  END IF;
  
  -- If user has push notifications enabled for this type, send push notification
  IF user_settings.push_enabled = true AND user_settings.is_enabled = true THEN
    -- Call the push notification worker via HTTP
    function_url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/push-notification-worker';
    service_role_key := current_setting('app.service_role_key', true);
    
    -- Use pg_net to make async HTTP call
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
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