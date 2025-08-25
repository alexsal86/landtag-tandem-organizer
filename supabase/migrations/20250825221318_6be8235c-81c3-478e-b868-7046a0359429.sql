-- Create poll_versions table for tracking poll changes
CREATE TABLE public.poll_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  changes_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES public.appointment_polls(id) ON DELETE CASCADE
);

-- Create poll_notifications table for notification management
CREATE TABLE public.poll_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'new_response', 'poll_updated', 'poll_deleted', 'deadline_reminder'
  sent_at TIMESTAMP WITH TIME ZONE,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (poll_id) REFERENCES public.appointment_polls(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES public.poll_participants(id) ON DELETE CASCADE
);

-- Enable RLS on new tables
ALTER TABLE public.poll_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for poll_versions
CREATE POLICY "Users can view versions of their polls" 
ON public.poll_versions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_versions.poll_id AND ap.user_id = auth.uid()
));

CREATE POLICY "Users can create versions of their polls" 
ON public.poll_versions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_versions.poll_id AND ap.user_id = auth.uid()
));

-- RLS policies for poll_notifications
CREATE POLICY "Users can view notifications for their polls" 
ON public.poll_notifications 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_notifications.poll_id AND ap.user_id = auth.uid()
));

CREATE POLICY "Users can manage notifications for their polls" 
ON public.poll_notifications 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_notifications.poll_id AND ap.user_id = auth.uid()
));

-- Add version column to appointment_polls
ALTER TABLE public.appointment_polls ADD COLUMN current_version INTEGER DEFAULT 1;

-- Create edge function for sending poll notifications
CREATE OR REPLACE FUNCTION public.create_poll_notification(
  _poll_id UUID,
  _participant_id UUID,
  _notification_type TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.poll_notifications (poll_id, participant_id, notification_type)
  VALUES (_poll_id, _participant_id, _notification_type)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create trigger for response notifications
CREATE OR REPLACE FUNCTION public.handle_poll_response_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create notification for new response
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_poll_notification(
      NEW.poll_id,
      NEW.participant_id,
      'new_response'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_poll_response_notification
  AFTER INSERT ON public.poll_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_poll_response_notification();

-- Update the generate_participant_token function to ensure uniqueness
CREATE OR REPLACE FUNCTION public.generate_participant_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_candidate text;
  token_exists boolean;
BEGIN
  LOOP
    token_candidate := encode(gen_random_bytes(32), 'base64url');
    
    SELECT EXISTS(
      SELECT 1 FROM public.poll_participants 
      WHERE token = token_candidate
    ) INTO token_exists;
    
    IF NOT token_exists THEN
      RETURN token_candidate;
    END IF;
  END LOOP;
END;
$$;