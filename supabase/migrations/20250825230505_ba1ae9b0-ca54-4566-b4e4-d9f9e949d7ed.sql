-- Fix the generate_participant_token function to use the correct crypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update the generate_participant_token function to use the correct function
CREATE OR REPLACE FUNCTION public.generate_participant_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  token_candidate text;
  token_exists boolean;
BEGIN
  LOOP
    -- Use gen_random_uuid and encode it as a base64 string for a unique token
    token_candidate := encode(digest(gen_random_uuid()::text || extract(epoch from now())::text, 'sha256'), 'base64');
    -- Remove characters that might cause URL issues
    token_candidate := replace(replace(replace(token_candidate, '+', '-'), '/', '_'), '=', '');
    
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