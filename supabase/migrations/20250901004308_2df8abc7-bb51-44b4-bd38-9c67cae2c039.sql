-- Fix the letter workflow trigger to only use existing fields
CREATE OR REPLACE FUNCTION public.log_letter_workflow_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.letter_workflow_history (
      letter_id,
      status_from,
      status_to,
      changed_by,
      notes,
      additional_data
    ) VALUES (
      NEW.id,
      COALESCE(OLD.status, 'created'),
      NEW.status,
      auth.uid(),
      NULL, -- Notes can be added separately if needed
      jsonb_build_object(
        'sent_method', NEW.sent_method,
        'sent_date', NEW.sent_date
        -- Removed reviewer_id as it doesn't exist in letters table
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;