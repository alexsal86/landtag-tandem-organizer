-- Trigger to dispatch mobile push notifications on new notifications row
CREATE OR REPLACE FUNCTION public.dispatch_mobile_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_token boolean;
  project_url text;
  service_key text;
BEGIN
  -- Only dispatch if user has at least one active mobile push token
  SELECT EXISTS (
    SELECT 1 FROM public.mobile_push_tokens
    WHERE user_id = NEW.user_id AND is_active = true
  ) INTO has_active_token;

  IF NOT has_active_token THEN
    RETURN NEW;
  END IF;

  -- Read configured project URL + service role key from vault
  BEGIN
    SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- vault not available; silently skip
    RETURN NEW;
  END;

  IF project_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/dispatch-mobile-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', COALESCE(NEW.priority, 'medium'),
      'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object('notification_id', NEW.id)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_mobile_push ON public.notifications;
CREATE TRIGGER trg_dispatch_mobile_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_mobile_push_on_notification();