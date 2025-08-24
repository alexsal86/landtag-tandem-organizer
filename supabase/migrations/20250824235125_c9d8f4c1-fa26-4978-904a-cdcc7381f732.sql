-- Remove duplicate triggers that cause double notifications
DROP TRIGGER IF EXISTS knowledge_document_notifications ON knowledge_documents;
DROP TRIGGER IF EXISTS task_notifications ON tasks;
DROP TRIGGER IF EXISTS message_notifications ON messages;
DROP TRIGGER IF EXISTS message_recipient_notifications ON message_recipients;

-- Update notification functions to be more idempotent
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param uuid, 
  type_name text, 
  title_param text, 
  message_param text, 
  data_param jsonb DEFAULT NULL::jsonb, 
  priority_param text DEFAULT 'medium'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_type_id_var UUID;
  notification_id_var UUID;
  settings_record RECORD;
  existing_notification UUID;
BEGIN
  -- Get notification type ID
  SELECT id INTO notification_type_id_var 
  FROM public.notification_types 
  WHERE name = type_name AND is_active = true;
  
  IF notification_type_id_var IS NULL THEN
    RAISE EXCEPTION 'Invalid notification type: %', type_name;
  END IF;
  
  -- Check for duplicate notification (prevent duplicates within 1 minute)
  SELECT id INTO existing_notification
  FROM public.notifications
  WHERE user_id = user_id_param 
    AND notification_type_id = notification_type_id_var
    AND data = data_param
    AND created_at > NOW() - INTERVAL '1 minute';
    
  IF existing_notification IS NOT NULL THEN
    RETURN existing_notification;
  END IF;
  
  -- Check if user has this notification type enabled
  SELECT * INTO settings_record
  FROM public.user_notification_settings
  WHERE user_id = user_id_param AND notification_type_id = notification_type_id_var;
  
  -- If no settings exist, create default enabled settings
  IF NOT FOUND THEN
    INSERT INTO public.user_notification_settings (user_id, notification_type_id, is_enabled, push_enabled)
    VALUES (user_id_param, notification_type_id_var, true, true);
    settings_record.is_enabled := true;
    settings_record.push_enabled := true;
  END IF;
  
  -- Only create notification if enabled
  IF settings_record.is_enabled THEN
    INSERT INTO public.notifications (
      user_id, notification_type_id, title, message, data, priority
    ) VALUES (
      user_id_param, notification_type_id_var, title_param, message_param, data_param, priority_param
    ) RETURNING id INTO notification_id_var;
    
    RETURN notification_id_var;
  END IF;
  
  RETURN NULL;
END;
$$;