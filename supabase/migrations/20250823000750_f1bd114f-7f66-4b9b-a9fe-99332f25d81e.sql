-- Create notification types table
CREATE TABLE public.notification_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user notification settings table
CREATE TABLE public.user_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type_id UUID NOT NULL REFERENCES public.notification_types(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type_id)
);

-- Create push subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type_id UUID NOT NULL REFERENCES public.notification_types(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_pushed BOOLEAN NOT NULL DEFAULT false,
  push_sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_types
CREATE POLICY "Everyone can view notification types" 
ON public.notification_types FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage notification types" 
ON public.notification_types FOR ALL 
USING (is_admin(auth.uid()));

-- RLS Policies for user_notification_settings
CREATE POLICY "Users can manage their own notification settings" 
ON public.user_notification_settings FOR ALL 
USING (user_id = auth.uid());

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions" 
ON public.push_subscriptions FOR ALL 
USING (user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (true);

-- Insert default notification types
INSERT INTO public.notification_types (name, label, description) VALUES
('task_created', 'Neue Aufgabe', 'Benachrichtigung bei neuen Aufgaben'),
('task_due', 'Aufgabe fällig', 'Benachrichtigung bei fälligen Aufgaben'),
('appointment_reminder', 'Termin-Erinnerung', 'Benachrichtigung vor Terminen'),
('message_received', 'Neue Nachricht', 'Benachrichtigung bei neuen Nachrichten'),
('budget_exceeded', 'Budget überschritten', 'Benachrichtigung bei Budget-Überschreitung'),
('system_update', 'System-Update', 'Benachrichtigung bei System-Updates');

-- Create function to send notification
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param UUID,
  type_name TEXT,
  title_param TEXT,
  message_param TEXT,
  data_param JSONB DEFAULT NULL,
  priority_param TEXT DEFAULT 'medium'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_type_id_var UUID;
  notification_id_var UUID;
  settings_record RECORD;
BEGIN
  -- Get notification type ID
  SELECT id INTO notification_type_id_var 
  FROM public.notification_types 
  WHERE name = type_name AND is_active = true;
  
  IF notification_type_id_var IS NULL THEN
    RAISE EXCEPTION 'Invalid notification type: %', type_name;
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

-- Create trigger function for task notifications
CREATE OR REPLACE FUNCTION public.handle_task_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Task created notification
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != '' THEN
      -- Find user by assigned_to name/email (you might need to adjust this logic)
      PERFORM public.create_notification(
        NEW.user_id,
        'task_created',
        'Neue Aufgabe zugewiesen',
        'Ihnen wurde die Aufgabe "' || NEW.title || '" zugewiesen.',
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title),
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
$$;

-- Create trigger function for appointment notifications
CREATE OR REPLACE FUNCTION public.handle_appointment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Appointment created notification
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'appointment_reminder',
      'Neuer Termin erstellt',
      'Neuer Termin: ' || NEW.title || ' am ' || TO_CHAR(NEW.start_time, 'DD.MM.YYYY HH24:MI'),
      jsonb_build_object('appointment_id', NEW.id, 'start_time', NEW.start_time),
      'medium'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
CREATE TRIGGER task_notifications_trigger
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_notifications();

CREATE TRIGGER appointment_notifications_trigger
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_notifications();

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_user_notification_settings_user_id ON public.user_notification_settings(user_id);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_notification_types_updated_at
  BEFORE UPDATE ON public.notification_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_notification_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();