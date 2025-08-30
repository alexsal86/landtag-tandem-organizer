-- Fix infinite recursion in letter_collaborators RLS policies
-- Drop the problematic policies first
DROP POLICY IF EXISTS "Users can create collaborators for accessible letters" ON public.letter_collaborators;
DROP POLICY IF EXISTS "Users can update collaborators for accessible letters" ON public.letter_collaborators;
DROP POLICY IF EXISTS "Users can delete collaborators for accessible letters" ON public.letter_collaborators;
DROP POLICY IF EXISTS "Users can view collaborators for accessible letters" ON public.letter_collaborators;

-- Create security definer function to check letter access without recursion
CREATE OR REPLACE FUNCTION public.can_access_letter_for_collaboration(_letter_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = _letter_id 
    AND l.created_by = _user_id
  );
$$;

-- Create new RLS policies using the security definer function
CREATE POLICY "Letter creators can manage collaborators"
ON public.letter_collaborators FOR ALL
USING (can_access_letter_for_collaboration(letter_id, auth.uid()))
WITH CHECK (can_access_letter_for_collaboration(letter_id, auth.uid()));

-- Allow collaborators to view their own collaborator records
CREATE POLICY "Users can view their collaborator records"
ON public.letter_collaborators FOR SELECT
USING (user_id = auth.uid() OR can_access_letter_for_collaboration(letter_id, auth.uid()));

-- Allow letter creators to view all collaborators for their letters
CREATE POLICY "Letter creators can view all collaborators"
ON public.letter_collaborators FOR SELECT
USING (can_access_letter_for_collaboration(letter_id, auth.uid()));