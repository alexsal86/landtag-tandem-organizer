-- Add missing notification types for documents, knowledge documents, and meetings
INSERT INTO public.notification_types (name, label, description) VALUES
  ('document_created', 'Neues Dokument', 'Benachrichtigung wenn ein neues Dokument erstellt wird'),
  ('knowledge_document_created', 'Neues Wissensdokument', 'Benachrichtigung wenn ein neues Wissensdokument erstellt wird'),
  ('meeting_created', 'Neuer Jour fixe', 'Benachrichtigung wenn ein neuer Jour fixe erstellt wird')
ON CONFLICT (name) DO NOTHING;

-- Create notification handler for documents
CREATE OR REPLACE FUNCTION public.handle_document_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Document created notification
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'document_created',
      'Neues Dokument erstellt',
      'Das Dokument "' || NEW.title || '" wurde erstellt.',
      jsonb_build_object('document_id', NEW.id, 'document_title', NEW.title),
      'medium'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create notification handler for knowledge documents
CREATE OR REPLACE FUNCTION public.handle_knowledge_document_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Knowledge document created notification
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.created_by,
      'knowledge_document_created',
      'Neues Wissensdokument erstellt',
      'Das Wissensdokument "' || NEW.title || '" wurde erstellt.',
      jsonb_build_object('document_id', NEW.id, 'document_title', NEW.title),
      'medium'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create notification handler for meetings (Jour fixe)
CREATE OR REPLACE FUNCTION public.handle_meeting_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Meeting created notification
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'meeting_created',
      'Neuer Jour fixe erstellt',
      'Ein neuer Jour fixe "' || NEW.title || '" wurde für den ' || TO_CHAR(NEW.meeting_date, 'DD.MM.YYYY') || ' erstellt.',
      jsonb_build_object('meeting_id', NEW.id, 'meeting_title', NEW.title, 'meeting_date', NEW.meeting_date),
      'medium'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create triggers for new notification handlers
DROP TRIGGER IF EXISTS document_notifications ON public.documents;
CREATE TRIGGER document_notifications
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_document_notifications();

DROP TRIGGER IF EXISTS knowledge_document_notifications ON public.knowledge_documents;
CREATE TRIGGER knowledge_document_notifications
  AFTER INSERT ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_knowledge_document_notifications();

DROP TRIGGER IF EXISTS meeting_notifications ON public.meetings;
CREATE TRIGGER meeting_notifications
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_notifications();

-- Enable real-time replica identity for notifications table (it's already in publication)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;