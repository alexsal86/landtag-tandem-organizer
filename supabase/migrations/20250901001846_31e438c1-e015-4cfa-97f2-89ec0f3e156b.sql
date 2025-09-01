-- Fix the trigger to use a simple call approach
CREATE OR REPLACE FUNCTION public.handle_letter_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'sent', set timestamps and trigger archiving
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    -- Set sent timestamp and workflow locked
    NEW.sent_at = now();
    NEW.sent_by = auth.uid();
    NEW.workflow_locked = true;
    
    -- Archive immediately
    NEW.status = 'archived';
    NEW.archived_at = now();
    NEW.archived_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';