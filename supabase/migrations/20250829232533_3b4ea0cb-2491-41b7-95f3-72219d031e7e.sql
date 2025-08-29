-- Drop existing RLS policies on letters table that might cause recursion
DROP POLICY IF EXISTS "Users can view letters in their tenant" ON public.letters;
DROP POLICY IF EXISTS "Users can create letters in their tenant" ON public.letters;
DROP POLICY IF EXISTS "Users can update letters in their tenant" ON public.letters;
DROP POLICY IF EXISTS "Users can delete letters in their tenant" ON public.letters;

-- Create safe RLS policies for letters table
CREATE POLICY "Users can view letters in their tenant" 
ON public.letters FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create letters in their tenant" 
ON public.letters FOR INSERT 
WITH CHECK (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) 
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update accessible letters" 
ON public.letters FOR UPDATE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) 
  AND (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.letter_collaborators lc 
      WHERE lc.letter_id = letters.id 
      AND lc.user_id = auth.uid() 
      AND lc.can_edit = true
    )
  )
);

CREATE POLICY "Users can delete their own letters" 
ON public.letters FOR DELETE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) 
  AND created_by = auth.uid()
);

-- Also fix the RLS policies for letter_collaborators if they exist
DROP POLICY IF EXISTS "Users can view collaborators on accessible letters" ON public.letter_collaborators;
DROP POLICY IF EXISTS "Users can manage collaborators on their letters" ON public.letter_collaborators;

CREATE POLICY "Users can view collaborators on accessible letters" 
ON public.letter_collaborators FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id 
    AND l.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
    AND (
      l.created_by = auth.uid() 
      OR letter_collaborators.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage collaborators on their letters" 
ON public.letter_collaborators FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id 
    AND l.created_by = auth.uid()
    AND l.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id 
    AND l.created_by = auth.uid()
    AND l.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
);