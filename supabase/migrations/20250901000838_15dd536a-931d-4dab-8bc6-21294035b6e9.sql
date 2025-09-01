-- Create function to handle automatic letter archiving
CREATE OR REPLACE FUNCTION public.handle_letter_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When status changes to 'sent', automatically archive after configured days
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    -- Set sent timestamp
    NEW.sent_at = now();
    NEW.sent_by = auth.uid();
    
    -- For immediate archiving (you can modify this logic)
    -- Set status to archived and archived timestamp
    NEW.status = 'archived';
    NEW.archived_at = now();
    NEW.archived_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for automatic letter archiving
DROP TRIGGER IF EXISTS trigger_letter_status_change ON public.letters;
CREATE TRIGGER trigger_letter_status_change
  BEFORE UPDATE ON public.letters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_letter_status_change();