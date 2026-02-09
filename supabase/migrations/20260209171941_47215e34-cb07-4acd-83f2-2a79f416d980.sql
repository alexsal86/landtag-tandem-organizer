
-- Fix search_path für die neue Trigger-Funktion
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets 
            WHERE name = 'supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret 
        FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', COALESCE(NEW.priority, 'medium'),
      'data', COALESCE(NEW.data, '{}'::jsonb),
      'from_trigger', true
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
