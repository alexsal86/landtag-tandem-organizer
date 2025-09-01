-- Fix the letter status change trigger to only set valid fields
CREATE OR REPLACE FUNCTION public.handle_letter_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When status changes to 'sent', set timestamps and lock workflow
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    -- Set sent timestamp and workflow locked with proper fields only
    NEW.sent_at = now();
    NEW.sent_by = auth.uid();
    NEW.workflow_locked = true;
    
    -- Don't auto-archive, let the letter stay as 'sent'
    -- Archiving will be handled separately by the archive-letter edge function
  END IF;
  
  RETURN NEW;
END;
$function$;