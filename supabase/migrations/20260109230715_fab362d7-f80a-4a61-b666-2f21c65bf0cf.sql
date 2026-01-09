-- Fix infinite recursion in RLS policies for quick_notes and quick_note_shares

-- Step 1: Create Security Definer Functions to break the recursion

-- Function to check if a user is the owner of a note (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_note_owner(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quick_notes
    WHERE id = _note_id AND user_id = _user_id
  )
$$;

-- Function to get all note IDs shared with a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_shared_note_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT note_id FROM quick_note_shares
  WHERE shared_with_user_id = _user_id
$$;

-- Step 2: Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can view shared notes" ON quick_notes;
DROP POLICY IF EXISTS "Note owners can manage shares" ON quick_note_shares;

-- Step 3: Recreate policies using the security definer functions

-- Policy for quick_notes: Allow users to view notes shared with them
CREATE POLICY "Users can view shared notes" ON quick_notes
FOR SELECT USING (
  id IN (SELECT public.get_shared_note_ids(auth.uid()))
);

-- Policy for quick_note_shares: Note owners can manage shares
CREATE POLICY "Note owners can manage shares" ON quick_note_shares
FOR ALL USING (
  public.is_note_owner(note_id, auth.uid())
);