-- Create trigger for knowledge document notifications (only if it doesn't exist)
CREATE OR REPLACE FUNCTION public.handle_knowledge_document_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Knowledge document created notification (only on INSERT)
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

-- Create trigger only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'handle_knowledge_document_notifications_trigger'
  ) THEN
    CREATE TRIGGER handle_knowledge_document_notifications_trigger
      AFTER INSERT ON public.knowledge_documents
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_knowledge_document_notifications();
  END IF;
END $$;