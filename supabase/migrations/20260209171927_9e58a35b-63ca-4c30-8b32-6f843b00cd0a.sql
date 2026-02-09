
-- Sicherstellen dass pg_net aktiviert ist
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger-Funktion: Ruft die Edge Function via pg_net auf
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger bei jedem INSERT auf notifications
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();
