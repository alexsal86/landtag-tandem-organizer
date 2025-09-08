-- Fix RLS policies for knowledge documents to allow service role access for collaboration
-- This ensures the Edge Function can verify document access

-- Add a policy that allows service role to read documents for collaboration verification
CREATE POLICY "Allow service role to read documents for collaboration" 
ON public.knowledge_documents 
FOR SELECT 
TO service_role 
USING (true);

-- Ensure knowledge_document_collaborators table allows service role operations
CREATE POLICY "Allow service role to manage collaborators" 
ON public.knowledge_document_collaborators 
FOR ALL 
TO service_role 
USING (true);

-- Add logging function for Edge Function debugging
CREATE OR REPLACE FUNCTION public.log_collaboration_event(
  event_type TEXT,
  document_id UUID,
  user_id UUID,
  details JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple logging that won't fail
  RAISE NOTICE 'Collaboration Event: % - Doc: % - User: % - Details: %', 
    event_type, document_id, user_id, details;
END;
$$;