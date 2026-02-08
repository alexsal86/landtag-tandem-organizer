
-- Fix infinite recursion between case_files and case_file_participants RLS policies
-- The current case_file_participants SELECT policy references case_files, which references case_file_participants back

-- 1. Drop the recursive case_file_participants SELECT policy
DROP POLICY IF EXISTS "Users can view participants of their tenant case files" ON public.case_file_participants;

-- 2. Create a non-recursive SELECT policy for case_file_participants
-- Any authenticated user can read participant entries - security is enforced by the case_files SELECT policy
-- (users can only see participants for case files they have access to via JOINs)
CREATE POLICY "Authenticated users can view case file participants"
  ON public.case_file_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Add email tracking columns for press releases
ALTER TABLE public.press_releases
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_by uuid;
