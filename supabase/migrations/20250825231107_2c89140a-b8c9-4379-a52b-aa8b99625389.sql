-- Fix the generate_participant_token function with a simpler approach
DROP FUNCTION IF EXISTS public.generate_participant_token();

CREATE OR REPLACE FUNCTION public.generate_participant_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  token_candidate text;
  token_exists boolean;
BEGIN
  LOOP
    -- Use gen_random_uuid and convert to string for uniqueness
    token_candidate := replace(gen_random_uuid()::text, '-', '') || 
                      replace(gen_random_uuid()::text, '-', '');
    
    SELECT EXISTS(
      SELECT 1 FROM public.poll_participants 
      WHERE token = token_candidate
    ) INTO token_exists;
    
    IF NOT token_exists THEN
      RETURN token_candidate;
    END IF;
  END LOOP;
END;
$function$;