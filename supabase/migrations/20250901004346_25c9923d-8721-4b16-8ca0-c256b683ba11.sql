-- Fix the trigger to handle cases where auth.uid() is null
CREATE OR REPLACE FUNCTION public.log_letter_workflow_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only log if status actually changed and user is authenticated
  IF OLD.status IS DISTINCT FROM NEW.status AND auth.uid() IS NOT NULL THEN
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
      NULL,
      jsonb_build_object(
        'sent_method', NEW.sent_method,
        'sent_date', NEW.sent_date
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;