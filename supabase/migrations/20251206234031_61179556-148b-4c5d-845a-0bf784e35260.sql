-- Create function for audit logging from database triggers
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  action_name TEXT;
  payload JSONB;
BEGIN
  -- Build action name based on table and operation
  action_name := TG_TABLE_NAME || '.' || LOWER(TG_OP);
  
  -- Build payload based on operation
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'action', action_name,
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old_data', to_jsonb(OLD),
      'timestamp', now()
    );
    
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (auth.uid(), payload);
    
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'action', action_name,
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old_data', to_jsonb(OLD),
      'new_data', to_jsonb(NEW),
      'timestamp', now()
    );
    
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (auth.uid(), payload);
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'action', action_name,
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'new_data', to_jsonb(NEW),
      'timestamp', now()
    );
    
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (auth.uid(), payload);
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Trigger for letters when status changes to 'sent' or when deleted
CREATE OR REPLACE FUNCTION public.audit_letter_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log when letter is sent
  IF TG_OP = 'UPDATE' AND NEW.status = 'sent' AND OLD.status != 'sent' THEN
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (
      auth.uid(),
      jsonb_build_object(
        'action', 'letter.sent',
        'letter_id', NEW.id,
        'subject', NEW.subject,
        'recipient_name', NEW.recipient_name,
        'timestamp', now()
      )
    );
  END IF;
  
  -- Log when letter is deleted
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (
      auth.uid(),
      jsonb_build_object(
        'action', 'letter.deleted',
        'letter_id', OLD.id,
        'subject', OLD.subject,
        'recipient_name', OLD.recipient_name,
        'timestamp', now()
      )
    );
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_letters_trigger
AFTER UPDATE OR DELETE ON public.letters
FOR EACH ROW
EXECUTE FUNCTION public.audit_letter_changes();

-- Trigger for user_roles changes
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_user_email TEXT;
BEGIN
  -- Try to get user email from profiles
  IF TG_OP = 'DELETE' THEN
    SELECT display_name INTO affected_user_email 
    FROM public.profiles 
    WHERE user_id = OLD.user_id;
    
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (
      auth.uid(),
      jsonb_build_object(
        'action', 'user.role_removed',
        'affected_user_id', OLD.user_id,
        'affected_user_name', affected_user_email,
        'role', OLD.role,
        'timestamp', now()
      )
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT display_name INTO affected_user_email 
    FROM public.profiles 
    WHERE user_id = NEW.user_id;
    
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (
      auth.uid(),
      jsonb_build_object(
        'action', 'user.role_assigned',
        'affected_user_id', NEW.user_id,
        'affected_user_name', affected_user_email,
        'role', NEW.role,
        'timestamp', now()
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    SELECT display_name INTO affected_user_email 
    FROM public.profiles 
    WHERE user_id = NEW.user_id;
    
    INSERT INTO public.audit_log_entries (user_id, payload)
    VALUES (
      auth.uid(),
      jsonb_build_object(
        'action', 'user.role_changed',
        'affected_user_id', NEW.user_id,
        'affected_user_name', affected_user_email,
        'old_role', OLD.role,
        'new_role', NEW.role,
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_user_role_changes();

-- Trigger for document deletions
CREATE OR REPLACE FUNCTION public.audit_document_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log_entries (user_id, payload)
  VALUES (
    auth.uid(),
    jsonb_build_object(
      'action', 'document.deleted',
      'document_id', OLD.id,
      'title', OLD.title,
      'file_name', OLD.file_name,
      'timestamp', now()
    )
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_documents_delete_trigger
AFTER DELETE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.audit_document_deletion();