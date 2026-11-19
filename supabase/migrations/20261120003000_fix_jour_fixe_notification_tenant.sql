CREATE FUNCTION public.create_notification(
  user_id_param uuid,
  type_name text,
  title_param text,
  message_param text,
  data_param jsonb,
  priority_param text,
  tenant_id_param uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  notification_type uuid;
  notification_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_tenant_memberships
    WHERE tenant_id = tenant_id_param AND user_id = user_id_param AND is_active
  ) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO notification_type
  FROM public.notification_types
  WHERE tenant_id = tenant_id_param AND name = type_name AND is_active;

  IF notification_type IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO notification_id
  FROM public.notifications
  WHERE tenant_id = tenant_id_param
    AND user_id = user_id_param
    AND notification_type_id = notification_type
    AND data = data_param
    AND created_at > now() - interval '1 minute';

  IF FOUND THEN
    RETURN notification_id;
  END IF;

  INSERT INTO public.user_notification_settings (user_id, notification_type_id, is_enabled, push_enabled)
  VALUES (user_id_param, notification_type, true, true)
  ON CONFLICT (user_id, notification_type_id) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM public.user_notification_settings
    WHERE user_id = user_id_param AND notification_type_id = notification_type AND is_enabled
  ) THEN
    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (tenant_id_param, user_id_param, notification_type, title_param, message_param, data_param, priority_param)
    RETURNING id INTO notification_id;
  END IF;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_meeting_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'meeting_created',
      'Neuer Jour fixe erstellt',
      'Ein neuer Jour fixe "' || NEW.title || '" wurde für den ' || to_char(NEW.meeting_date, 'DD.MM.YYYY') || ' erstellt.',
      jsonb_build_object('meeting_id', NEW.id, 'meeting_title', NEW.title, 'meeting_date', NEW.meeting_date),
      'medium',
      NEW.tenant_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
